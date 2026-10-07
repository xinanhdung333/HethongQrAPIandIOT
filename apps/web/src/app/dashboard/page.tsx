"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Banknote,
  BarChart3,
  Boxes,
  CheckCircle2,
  Clock3,
  Code2,
  KeyRound,
  PackageCheck,
  QrCode,
  Radio,
  ReceiptText,
  ScanLine,
  ShieldCheck,
  Ticket,
  TrendingUp,
  Truck,
  type LucideIcon
} from "lucide-react";
import { RealtimeStatus } from "@/components/realtime-status";
import { api, money } from "@/lib/api";
import { DashboardData, DashboardTicketOrder } from "@/lib/dashboard";

const emptyData: DashboardData = {
  rentals: [],
  apiRentals: [],
  shows: [],
  apiKeys: [],
  ticketOrders: [],
  purchasedTicketOrders: [],
  payouts: [],
  tickets: [],
  externalQrCodes: []
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api<DashboardData>("/dashboard?view=overview", { cache: "no-store" })
      .then(setData)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Khong tai duoc dashboard."))
      .finally(() => setLoading(false));
  }, []);

  const metrics = useMemo(() => getMetrics(data), [data]);
  const recentOrders = useMemo(() => sortByDate(data.ticketOrders).slice(0, 6), [data.ticketOrders]);
  const recentShows = useMemo(() => sortByDate(data.shows).slice(0, 5), [data.shows]);
  const recentRentals = useMemo(() => sortByDate(data.rentals).slice(0, 5), [data.rentals]);
  const recentApiRentals = useMemo(() => sortByDate(data.apiRentals).slice(0, 5), [data.apiRentals]);
  const expiringQr = useMemo(() => sortByDate(data.externalQrCodes, "expiresAt").slice(0, 5), [data.externalQrCodes]);
  const dailyRevenue = useMemo(() => buildDailyRevenue(data.ticketOrders), [data.ticketOrders]);
  const showBars = useMemo(() => buildShowBars(data.shows), [data.shows]);
  const orderStatus = useMemo(() => buildStatusSlices(data.ticketOrders.map((order) => order.status)), [data.ticketOrders]);
  const keyStatus = useMemo(() => buildStatusSlices(data.apiKeys.map((key) => key.status ?? "active")), [data.apiKeys]);
  const scanBars = useMemo(() => buildScanBars(data.externalQrCodes), [data.externalQrCodes]);

  if (loading) {
    return <div className="panel p-6 text-sm text-zinc-600">Dang tai dashboard...</div>;
  }

  if (error) {
    return (
      <div className="panel p-6">
        <h1 className="text-xl font-semibold">Khong tai duoc dashboard</h1>
        <p className="mt-2 text-sm text-zinc-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500">Tong quan van hanh</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            Theo doi thiet bi thue, show ban ve, API key, QR scan va doanh thu tren mot man hinh.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/tao-show" className="btn btn-primary text-sm"><Radio size={16} /> Tao show</Link>
          <Link href="/thue-thiet-bi" className="btn btn-secondary bg-white text-sm"><Truck size={16} /> Thue thiet bi</Link>
          <Link href="/dashboard/scan" className="btn btn-secondary bg-white text-sm"><ScanLine size={16} /> Quet thu</Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={ReceiptText} label="Doanh thu ve" value={money(metrics.ticketRevenue)} detail={`${metrics.paidOrders}/${data.ticketOrders.length} don paid`} />
        <Stat icon={Banknote} label="Payout cho doi tac" value={money(metrics.payoutAmount)} detail={`${data.payouts.length} lenh payout`} />
        <Stat icon={Ticket} label="Ve da ban" value={String(metrics.soldTickets)} detail={`${metrics.usedTickets} ve da check-in`} />
        <Stat icon={Radio} label="Show dang chay" value={String(metrics.activeShows)} detail={`${data.shows.length} tong show`} />
        <Stat icon={Truck} label="Don thue thiet bi" value={String(data.rentals.length)} detail={`${metrics.activeRentals} don active`} />
        <Stat icon={Code2} label="Don thue API" value={String(data.apiRentals.length)} detail={`${metrics.totalQuota.toLocaleString("vi-VN")} quota`} />
        <Stat icon={KeyRound} label="API keys active" value={String(metrics.activeKeys)} detail={`${data.apiKeys.length} tong key`} />
        <Stat icon={QrCode} label="QR ngoai he thong" value={String(data.externalQrCodes.length)} detail={`${metrics.usedExternalQr} QR da dung`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="panel overflow-hidden">
          <PanelHeader
            title="Bieu do cot doanh thu 14 ngay"
            description="Moi cot la doanh thu paid trong mot ngay."
            actionHref="/dashboard/payments"
            actionLabel="Giao dich"
          />
          <ColumnChart data={dailyRevenue} valueLabel={(value) => money(value)} />
        </section>

        <section className="panel overflow-hidden">
          <PanelHeader
            title="Ty trong trang thai"
            description="So sanh nhanh don ve va API key."
            actionHref="/dashboard/api-keys"
            actionLabel="API keys"
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-1">
            <DonutChart title="Don ve" data={orderStatus} emptyText="Chua co don ve" />
            <DonutChart title="API key" data={keyStatus} emptyText="Chua co key" />
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <section className="panel overflow-hidden">
          <PanelHeader
            title="Bieu do cot ve ban theo show"
            description="So sanh top show theo so ve da ban."
            actionHref="/dashboard/shows"
            actionLabel="Show"
          />
          <ShowColumnChart data={showBars} />
        </section>

        <section className="panel overflow-hidden">
          <PanelHeader
            title="Hoat dong QR / scan"
            description="So QR tao moi va luot scan theo ngay."
            actionHref="/dashboard/scan"
            actionLabel="Quet thu"
          />
          <ActivityBars data={scanBars} />
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="panel overflow-hidden">
          <PanelHeader
            title="Funnel ban ve"
            description="Tu so ghe mo ban den paid, check-in va doanh thu thuc te."
            actionHref="/dashboard/shows"
            actionLabel="Quan ly show"
          />
          <div className="grid gap-4 p-5 md:grid-cols-4">
            <FunnelStep label="Tong suc chua" value={metrics.totalTickets} tone="zinc" />
            <FunnelStep label="Da ban" value={metrics.soldTickets} tone="emerald" />
            <FunnelStep label="Da check-in" value={metrics.usedTickets} tone="sky" />
            <FunnelStep label="Con lai" value={Math.max(metrics.totalTickets - metrics.soldTickets, 0)} tone="amber" />
          </div>
          <div className="border-t border-zinc-200 p-5">
            <Progress label="Ty le ban ve" value={percent(metrics.soldTickets, metrics.totalTickets)} />
            <Progress label="Ty le check-in" value={percent(metrics.usedTickets, Math.max(metrics.soldTickets, 1))} className="mt-4" />
          </div>
        </section>

        <RealtimeStatus showIds={data.shows.map((show) => show.id)} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="panel overflow-hidden">
          <PanelHeader
            title="Don ve gan day"
            description="Theo doi nguoi mua, trang thai thanh toan va gia tri don."
            actionHref="/dashboard/tickets"
            actionLabel="Xem tat ca"
          />
          <div className="overflow-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="border-y border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Nguoi mua</th>
                  <th className="px-5 py-3 font-medium">Show</th>
                  <th className="px-5 py-3 font-medium">So ve</th>
                  <th className="px-5 py-3 font-medium">Gia tri</th>
                  <th className="px-5 py-3 font-medium">Trang thai</th>
                  <th className="px-5 py-3 font-medium">Thoi gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-5 py-4">
                      <b>{order.buyerName ?? "Khach mua ve"}</b>
                      <p className="mt-1 text-xs text-zinc-500">{order.buyerEmail ?? order.buyerPhone ?? "Chua co lien he"}</p>
                    </td>
                    <td className="px-5 py-4">{order.show.name}</td>
                    <td className="px-5 py-4">{order.quantity}</td>
                    <td className="px-5 py-4 font-medium">{money(order.totalAmount)}</td>
                    <td className="px-5 py-4"><Status value={order.status} /></td>
                    <td className="px-5 py-4 text-zinc-500">{formatDate(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!recentOrders.length && <Empty text="Chua co don ve nao." />}
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-semibold">Trung tam hanh dong</h2>
          <div className="mt-4 grid gap-3">
            <Action href="/dashboard/rentals" icon={Truck} title="Xu ly don thue" desc={`${metrics.pendingRentals} don dang cho`} />
            <Action href="/dashboard/api-keys" icon={KeyRound} title="Kiem tra API key" desc={`${metrics.suspendedKeys} key can chu y`} />
            <Action href="/dashboard/settings/payout" icon={Banknote} title="Cau hinh payout" desc={`${data.payouts.length} tai khoan/lenh`} />
            <Action href="/dashboard/gate-offline" icon={ShieldCheck} title="Dong bo cong offline" desc={`${metrics.offlineTickets} ve co JWT offline`} />
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <ListPanel title="Show can theo doi" href="/dashboard/shows" empty="Chua co show.">
          {recentShows.map((show) => (
            <ListRow key={show.id} title={show.name} meta={`${show.soldTickets}/${show.totalTickets} ve`} value={show.status ?? "ACTIVE"} />
          ))}
        </ListPanel>

        <ListPanel title="Thiet bi thue" href="/dashboard/rentals" empty="Chua co don thue.">
          {recentRentals.map((rental) => (
            <ListRow key={rental.id} title={rental.product?.name ?? "Thiet bi SmartQR"} meta={`${rental.quantity} thiet bi - ${money(rental.total)}`} value={rental.status} />
          ))}
        </ListPanel>

        <ListPanel title="Ung dung API" href="/dashboard/api-keys" empty="Chua co app API.">
          {recentApiRentals.map((rental) => (
            <ListRow key={rental.id} title={rental.appName} meta={`${rental.plan} - ${rental.quota.toLocaleString("vi-VN")} quota`} value={rental.status} />
          ))}
        </ListPanel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="panel p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">Suc khoe bao mat</h2>
              <p className="mt-1 text-sm text-zinc-600">Nhung diem nen kiem tra moi ngay.</p>
            </div>
            <ShieldCheck className="text-zinc-400" size={22} />
          </div>
          <div className="mt-5 grid gap-3">
            <Health ok={metrics.activeKeys > 0} text="API key dang hoat dong va duoc hash truoc khi luu." />
            <Health ok={metrics.offlineTickets > 0} text="Ve offline JWT san sang cho cong mat mang." />
            <Health ok={metrics.invalidScans === 0} text={`${metrics.invalidScans} scan bi tu choi trong du lieu hien tai.`} />
            <Health ok={metrics.suspendedKeys === 0} text={`${metrics.suspendedKeys} API key bi suspend/revoke.`} />
          </div>
        </section>

        <section className="panel overflow-hidden">
          <PanelHeader
            title="QR sap het han / scan gan day"
            description="Theo doi QR ngoai he thong va trang thai scan gan nhat."
            actionHref="/dashboard/api-keys"
            actionLabel="API console"
          />
          <div className="divide-y divide-zinc-200">
            {expiringQr.map((qr) => {
              const latestScan = sortByDate(qr.scanLogs ?? [])[0];
              return (
                <div key={qr.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <b className="block truncate">{qr.code}</b>
                    <p className="mt-1 text-sm text-zinc-600">{qr.resourceType} - het han {formatDate(qr.expiresAt)}</p>
                    {latestScan && <p className="mt-1 text-xs text-zinc-500">Scan gan nhat: {latestScan.gateId} - {latestScan.valid ? "valid" : latestScan.reason ?? "invalid"}</p>}
                  </div>
                  <Status value={qr.isUsed ? "USED" : "READY"} />
                </div>
              );
            })}
            {!expiringQr.length && <Empty text="Chua co QR ngoai he thong." />}
          </div>
        </section>
      </div>
    </div>
  );
}

function getMetrics(data: DashboardData) {
  const paidOrders = data.ticketOrders.filter((order) => order.status === "PAID");
  const ticketRevenue = paidOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const payoutAmount = data.payouts.reduce((sum, payout) => sum + payout.amount, 0);
  const totalTickets = data.shows.reduce((sum, show) => sum + show.totalTickets, 0);
  const soldTickets = data.shows.reduce((sum, show) => sum + show.soldTickets, 0);
  const usedTickets = data.tickets.filter((ticketItem) => ticketItem.isUsed).length
    || data.ticketOrders.reduce((sum, order) => sum + order.tickets.filter((ticketItem) => ticketItem.isUsed).length, 0);
  const activeShows = data.shows.filter((show) => (show.status ?? "ACTIVE") === "ACTIVE").length;
  const activeRentals = data.rentals.filter((rental) => ["ACTIVE", "PAID", "READY"].includes(rental.status)).length;
  const pendingRentals = data.rentals.filter((rental) => ["PENDING", "WAITING_PAYMENT"].includes(rental.status)).length;
  const totalQuota = data.apiRentals.reduce((sum, rental) => sum + rental.quota, 0);
  const activeKeys = data.apiKeys.filter((key) => (key.status ?? "active").toLowerCase() === "active").length;
  const suspendedKeys = data.apiKeys.filter((key) => ["suspended", "revoked"].includes((key.status ?? "").toLowerCase())).length;
  const usedExternalQr = data.externalQrCodes.filter((qr) => qr.isUsed).length;
  const invalidScans = data.externalQrCodes.reduce((sum, qr) => sum + (qr.scanLogs ?? []).filter((log) => !log.valid).length, 0);
  const offlineTickets = data.tickets.filter((ticketItem) => Boolean(ticketItem.qrOfflineJwt)).length;

  return {
    paidOrders: paidOrders.length,
    ticketRevenue,
    payoutAmount,
    totalTickets,
    soldTickets,
    usedTickets,
    activeShows,
    activeRentals,
    pendingRentals,
    totalQuota,
    activeKeys,
    suspendedKeys,
    usedExternalQr,
    invalidScans,
    offlineTickets
  };
}

function buildDailyRevenue(orders: DashboardTicketOrder[]) {
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (13 - index));
    const key = date.toISOString().slice(0, 10);
    return { key, label: `${date.getDate()}/${date.getMonth() + 1}`, value: 0 };
  });
  const byKey = new Map(days.map((day) => [day.key, day]));

  for (const order of orders) {
    if (order.status !== "PAID" || !order.createdAt) continue;
    const key = new Date(order.createdAt).toISOString().slice(0, 10);
    const day = byKey.get(key);
    if (day) day.value += order.totalAmount;
  }

  return days;
}

function buildShowBars(shows: DashboardData["shows"]) {
  return [...shows]
    .sort((a, b) => b.soldTickets - a.soldTickets)
    .slice(0, 7)
    .map((show) => ({
      label: show.name,
      value: show.soldTickets,
      total: Math.max(show.totalTickets, show.soldTickets, 1),
      meta: `${show.soldTickets}/${show.totalTickets} ve`
    }));
}

function buildStatusSlices(values: string[]) {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const key = (raw || "unknown").toUpperCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value], index) => ({ label, value, color: chartColors[index % chartColors.length] }));
}

function buildScanBars(codes: DashboardData["externalQrCodes"]) {
  const days = Array.from({ length: 10 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (9 - index));
    const key = date.toISOString().slice(0, 10);
    return { key, label: String(date.getDate()).padStart(2, "0"), created: 0, scans: 0 };
  });
  const byKey = new Map(days.map((day) => [day.key, day]));

  for (const code of codes) {
    if (code.createdAt) {
      const day = byKey.get(new Date(code.createdAt).toISOString().slice(0, 10));
      if (day) day.created += 1;
    }
    for (const log of code.scanLogs ?? []) {
      const day = byKey.get(new Date(log.createdAt).toISOString().slice(0, 10));
      if (day) day.scans += 1;
    }
  }

  return days;
}

const chartColors = ["#18181b", "#10b981", "#0284c7", "#f59e0b", "#71717a"];

function Stat({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-zinc-100 text-zinc-800"><Icon size={18} /></span>
        <Activity size={16} className="text-zinc-300" />
      </div>
      <span className="mt-4 block text-sm text-zinc-500">{label}</span>
      <b className="mt-1 block break-words text-2xl tracking-tight">{value}</b>
      <p className="mt-2 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

function PanelHeader({ title, description, actionHref, actionLabel }: { title: string; description: string; actionHref: string; actionLabel: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 p-5">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-zinc-600">{description}</p>
      </div>
      <Link href={actionHref} className="inline-flex items-center gap-1 text-sm font-medium text-zinc-700 transition hover:text-zinc-950">
        {actionLabel} <ArrowRight size={15} />
      </Link>
    </div>
  );
}

function FunnelStep({ label, value, tone }: { label: string; value: number; tone: "zinc" | "emerald" | "sky" | "amber" }) {
  const toneClass = {
    zinc: "bg-zinc-100 text-zinc-900",
    emerald: "bg-emerald-50 text-emerald-700",
    sky: "bg-sky-50 text-sky-700",
    amber: "bg-amber-50 text-amber-700"
  }[tone];

  return (
    <div className={`rounded-lg p-4 ${toneClass}`}>
      <span className="text-xs font-medium uppercase">{label}</span>
      <b className="mt-2 block text-2xl">{value.toLocaleString("vi-VN")}</b>
    </div>
  );
}

function Progress({ label, value, className = "" }: { label: string; value: number; className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-zinc-500">{value}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full bg-zinc-900" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ColumnChart({ data, valueLabel }: { data: Array<{ label: string; value: number }>; valueLabel: (value: number) => string }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-500">Tong 14 ngay</p>
          <b className="mt-1 block text-2xl tracking-tight">{valueLabel(total)}</b>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          <TrendingUp size={16} /> {valueLabel(maxValue)} dinh ngay
        </div>
      </div>
      <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex h-64 items-end gap-2 border-b border-zinc-200">
          {data.map((item) => {
            const height = Math.max(8, (item.value / maxValue) * 220);
            return (
              <div key={item.label} className="group flex min-w-6 flex-1 flex-col items-center justify-end gap-2">
                <div className="relative flex h-[220px] w-full items-end justify-center">
                  <span className="absolute bottom-full mb-2 hidden rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-medium shadow-sm group-hover:block">
                    {valueLabel(item.value)}
                  </span>
                  <div className="w-full max-w-10 rounded-t-lg bg-zinc-900 transition group-hover:bg-zinc-700" style={{ height }} />
                </div>
                <span className="text-[10px] text-zinc-500">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ShowColumnChart({ data }: { data: Array<{ label: string; value: number; total: number; meta: string }> }) {
  if (!data.length) return <Empty text="Chua co show de ve bieu do cot." />;
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="p-5">
      <div className="flex h-72 items-end gap-3 border-b border-zinc-200">
        {data.map((item) => {
          const height = Math.max(10, (item.value / maxValue) * 230);
          return (
            <div key={item.label} className="group flex min-w-14 flex-1 flex-col items-center justify-end gap-2">
              <div className="relative flex h-[230px] w-full items-end justify-center">
                <span className="absolute bottom-full mb-2 hidden whitespace-nowrap rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-medium shadow-sm group-hover:block">
                  {item.meta}
                </span>
                <div className="w-full max-w-12 rounded-t-lg bg-zinc-900 transition group-hover:bg-zinc-700" style={{ height }} />
              </div>
              <span className="line-clamp-2 min-h-8 text-center text-[10px] leading-4 text-zinc-500">{item.label}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 grid gap-2">
        {data.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 text-xs text-zinc-500">
            <span className="truncate">{item.label}</span>
            <span className="shrink-0 font-medium text-zinc-700">{item.meta}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutChart({ title, data, emptyText }: { title: string; data: Array<{ label: string; value: number; color: string }>; emptyText: string }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const gradient = total
    ? data.map((item) => {
      const start = cursor;
      const end = cursor + (item.value / total) * 100;
      cursor = end;
      return `${item.color} ${start}% ${end}%`;
    }).join(", ")
    : "#e4e4e7 0% 100%";

  return (
    <div className="rounded-lg border border-zinc-200 p-4">
      <div className="flex items-center gap-4">
        <div className="grid size-24 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${gradient})` }}>
          <div className="grid size-14 place-items-center rounded-full bg-white text-center">
            <b className="text-lg">{total}</b>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-zinc-500" />
            <h3 className="font-semibold">{title}</h3>
          </div>
          <div className="mt-3 grid gap-2">
            {data.length ? data.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex min-w-0 items-center gap-2 truncate">
                  <span className="size-2 rounded-full" style={{ background: item.color }} />
                  <span className="truncate">{item.label}</span>
                </span>
                <b>{item.value}</b>
              </div>
            )) : <span className="text-sm text-zinc-500">{emptyText}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityBars({ data }: { data: Array<{ label: string; created: number; scans: number }> }) {
  const maxValue = Math.max(...data.flatMap((item) => [item.created, item.scans]), 1);
  return (
    <div className="p-5">
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-zinc-900" /> QR tao</span>
        <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-500" /> Scan</span>
      </div>
      <div className="mt-5 flex h-56 items-end gap-2 border-b border-zinc-200">
        {data.map((item) => (
          <div key={item.label} className="flex min-w-7 flex-1 flex-col items-center justify-end gap-2">
            <div className="flex h-44 w-full items-end justify-center gap-1">
              <div className="w-2 rounded-t bg-zinc-900" style={{ height: `${Math.max(4, (item.created / maxValue) * 160)}px` }} />
              <div className="w-2 rounded-t bg-emerald-500" style={{ height: `${Math.max(4, (item.scans / maxValue) * 160)}px` }} />
            </div>
            <span className="text-[10px] text-zinc-500">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Action({ href, icon: Icon, title, desc }: { href: string; icon: LucideIcon; title: string; desc: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 transition hover:bg-zinc-50">
      <span className="grid size-10 place-items-center rounded-lg bg-zinc-100"><Icon size={17} /></span>
      <span className="min-w-0 flex-1">
        <b className="block text-sm">{title}</b>
        <span className="mt-0.5 block truncate text-xs text-zinc-500">{desc}</span>
      </span>
      <ArrowRight size={15} className="text-zinc-400" />
    </Link>
  );
}

function ListPanel({ title, href, empty, children }: { title: string; href: string; empty: string; children: React.ReactNode }) {
  const isEmpty = Array.isArray(children) && children.length === 0;
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 p-5">
        <h2 className="font-semibold">{title}</h2>
        <Link href={href} className="text-sm font-medium text-zinc-600 hover:text-zinc-950">Mo</Link>
      </div>
      <div className="divide-y divide-zinc-200">
        {isEmpty ? <Empty text={empty} /> : children}
      </div>
    </section>
  );
}

function ListRow({ title, meta, value }: { title: string; meta: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 p-5">
      <div className="min-w-0">
        <b className="block truncate text-sm">{title}</b>
        <p className="mt-1 truncate text-xs text-zinc-500">{meta}</p>
      </div>
      <Status value={value} />
    </div>
  );
}

function Health({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3">
      {ok ? <CheckCircle2 size={18} className="mt-0.5 text-emerald-600" /> : <AlertTriangle size={18} className="mt-0.5 text-amber-600" />}
      <p className="text-sm leading-6 text-zinc-600">{text}</p>
    </div>
  );
}

function Status({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const positive = ["paid", "active", "ready", "used"].includes(normalized);
  return (
    <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold uppercase ${positive ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
      {value}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="p-5 text-sm text-zinc-500">{text}</p>;
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

function sortByDate<T extends Record<string, unknown>>(items: T[], key = "createdAt") {
  return [...items].sort((a, b) => {
    const aTime = typeof a[key] === "string" ? new Date(a[key] as string).getTime() : 0;
    const bTime = typeof b[key] === "string" ? new Date(b[key] as string).getTime() : 0;
    return bTime - aTime;
  });
}
