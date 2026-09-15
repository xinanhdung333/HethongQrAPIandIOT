"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Copy,
  Loader2,
  Power,
  Radio,
  Search,
  Ticket,
  type LucideIcon
} from "lucide-react";
import { api, money } from "@/lib/api";
import { DashboardData, DashboardTicketOrder } from "@/lib/dashboard";

const ORDER_PAGE_SIZE = 6;

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

export default function ShowsDashboardPage() {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [endingId, setEndingId] = useState("");
  const [openShowId, setOpenShowId] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await api<DashboardData>("/dashboard", { cache: "no-store" }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tải được dữ liệu show.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function endShow(id: string) {
    setEndingId(id);
    try {
      await api(`/shows/${id}/end`, { method: "PATCH", body: "{}" });
      await load();
    } finally {
      setEndingId("");
    }
  }

  const ordersByShow = useMemo(() => {
    const map = new Map<string, DashboardTicketOrder[]>();
    for (const order of data.ticketOrders ?? []) {
      const current = map.get(order.show.id) ?? [];
      current.push(order);
      map.set(order.show.id, current);
    }
    return map;
  }, [data.ticketOrders]);

  const active = data.shows.filter((show) => (show.status ?? "ACTIVE") === "ACTIVE").length;
  const ended = data.shows.filter((show) => show.status === "ENDED").length;
  const soldTickets = data.shows.reduce((sum, show) => sum + show.soldTickets, 0);

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500">Show đã mở</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Show</h1>
        </div>
        <Link href="/tao-show" className="btn btn-primary text-sm">Tạo show</Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Stat icon={Radio} label="Tổng show" value={String(data.shows.length)} />
        <Stat icon={CheckCircle2} label="Đang chạy" value={String(active)} />
        <Stat icon={CalendarDays} label="Đã kết thúc" value={String(ended)} />
        <Stat icon={Ticket} label="Vé đã bán" value={String(soldTickets)} />
      </div>

      {loading && <p className="panel mt-6 p-5 text-sm text-zinc-600">Đang tải show...</p>}
      {error && <p className="panel mt-6 border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</p>}

      {!error && (
        <div className="mt-6 grid gap-4">
          {data.shows.map((show) => {
            const orders = ordersByShow.get(show.id) ?? [];
            const usedTickets = orders.reduce((sum, order) => sum + order.tickets.filter((ticketItem) => ticketItem.isUsed).length, 0);
            const revenue = orders.reduce((sum, order) => sum + (order.status === "PAID" ? order.totalAmount : 0), 0);
            const isOpen = openShowId === show.id;

            return (
              <article key={show.id} className="panel overflow-hidden">
                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <b className="block truncate text-lg">{show.name}</b>
                      <p className="mt-1 text-sm text-zinc-600">
                        {show.soldTickets}/{show.totalTickets} vé, {money(show.ticketPrice)}/vé
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-zinc-100 px-3 py-1 text-sm font-medium">{show.status ?? "ACTIVE"}</span>
                      <Link href={`/e/${show.slug}`} className="btn btn-secondary text-sm">Mở show</Link>
                      <button className="btn btn-secondary text-sm" disabled={show.status === "ENDED" || endingId === show.id} onClick={() => void endShow(show.id)}>
                        {endingId === show.id ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
                        Kết thúc
                      </button>
                      <button className="btn btn-primary text-sm" onClick={() => setOpenShowId((current) => current === show.id ? "" : show.id)}>
                        <Ticket size={16} />
                        Quản lý vé
                        <ChevronDown size={16} className={`transition ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-zinc-600 md:grid-cols-2">
                    <p>Địa điểm: {show.location ?? "Đang cập nhật"}</p>
                    <p>Ngày diễn ra: {show.startAt ? new Date(show.startAt).toLocaleString("vi-VN") : "Đang cập nhật"}</p>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <MiniStat label="Đơn bán" value={String(orders.length)} />
                    <MiniStat label="Vé bán" value={String(show.soldTickets)} />
                    <MiniStat label="Đã check-in" value={`${usedTickets}/${show.soldTickets}`} />
                    <MiniStat label="Doanh thu" value={money(revenue)} />
                  </div>
                </div>

                {isOpen && <TicketManager orders={orders} loading={loading} />}
              </article>
            );
          })}
          {!loading && !data.shows.length && (
            <p className="panel p-5 text-sm text-zinc-600">Chưa có show. Hãy tạo show white-label để lấy link bán vé.</p>
          )}
        </div>
      )}

      <section className="panel mt-6 p-5">
        <h2 className="font-semibold">Theo dõi bán vé</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Người mua ngoài hệ thống vẫn nhập tên, email, SĐT ở link public. Khi đơn demo paid, vé QR sẽ nằm ngay dưới show tương ứng.
        </p>
      </section>
    </div>
  );
}

function TicketManager({ orders, loading }: { orders: DashboardTicketOrder[]; loading: boolean }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [openOrderId, setOpenOrderId] = useState("");

  const filteredOrders = useMemo(() => {
    const keyword = normalize(query);
    if (!keyword) return orders;
    return orders.filter((order) => normalize(`${order.buyerName ?? ""} ${order.buyerEmail ?? ""} ${order.buyerPhone ?? ""} ${order.buyerNote ?? ""}`).includes(keyword));
  }, [orders, query]);

  const pagedOrders = paginate(filteredOrders, page, ORDER_PAGE_SIZE);
  const openOrder = orders.find((order) => order.id === openOrderId);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    setOpenOrderId("");
    setQuery("");
    setPage(1);
  }, [orders]);

  return (
    <div className="border-t border-zinc-200 bg-zinc-50/50">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <h3 className="font-semibold">Người mua vé</h3>
          <p className="mt-1 text-sm text-zinc-600">Bấm “Xem vé” để mở QR/code của từng đơn.</p>
        </div>
        <div className="w-full sm:w-80">
          <SearchField value={query} onChange={setQuery} placeholder="Tìm tên, email, SĐT..." />
        </div>
      </div>

      <div className="overflow-auto border-y border-zinc-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-5 py-3 font-medium">Người mua</th>
              <th className="px-5 py-3 font-medium">Liên hệ</th>
              <th className="px-5 py-3 font-medium">Số vé</th>
              <th className="px-5 py-3 font-medium">Check-in</th>
              <th className="px-5 py-3 font-medium">Thanh toán</th>
              <th className="px-5 py-3 font-medium">Trạng thái</th>
              <th className="px-5 py-3 font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {pagedOrders.items.map((order) => {
              const used = order.tickets.filter((ticketItem) => ticketItem.isUsed).length;
              return (
                <tr key={order.id} className={openOrderId === order.id ? "bg-zinc-50" : undefined}>
                  <td className="px-5 py-4">
                    <b>{order.buyerName ?? "Khách mua vé"}</b>
                    {order.createdAt && <p className="mt-1 text-xs text-zinc-500">{new Date(order.createdAt).toLocaleString("vi-VN")}</p>}
                    {order.buyerNote && <p className="mt-1 max-w-56 truncate text-xs text-zinc-500">Ghi chú: {order.buyerNote}</p>}
                  </td>
                  <td className="px-5 py-4">
                    <p>{order.buyerEmail ?? "-"}</p>
                    <p className="mt-1 text-xs text-zinc-500">{order.buyerPhone ?? "Chưa có SĐT"}</p>
                  </td>
                  <td className="px-5 py-4">{order.quantity}</td>
                  <td className="px-5 py-4">{used}/{order.tickets.length || order.quantity}</td>
                  <td className="px-5 py-4">{money(order.totalAmount)}</td>
                  <td className="px-5 py-4"><Status value={order.status} /></td>
                  <td className="px-5 py-4">
                    <button className="btn btn-secondary text-xs" onClick={() => setOpenOrderId((current) => current === order.id ? "" : order.id)}>
                      {openOrderId === order.id ? "Ẩn vé" : "Xem vé"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && !filteredOrders.length && <p className="p-5 text-sm text-zinc-600">Show này chưa có người mua phù hợp.</p>}
      </div>

      <div className="px-5 py-4">
        <Pager page={page} totalPages={pagedOrders.totalPages} onPageChange={setPage} />
        {openOrder ? <TicketQrCards order={openOrder} /> : (
          <p className="rounded-lg border border-dashed border-zinc-200 bg-white p-4 text-sm text-zinc-600">
            Chưa mở đơn nào. QR/code chỉ hiện khi bạn bấm “Xem vé”.
          </p>
        )}
      </div>
    </div>
  );
}

function TicketQrCards({ order }: { order: DashboardTicketOrder }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {order.tickets.map((ticketItem, index) => (
        <div key={ticketItem.id} className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <b className="text-sm">Vé #{index + 1}</b>
            <span className="rounded-lg bg-zinc-100 px-2 py-1 text-xs font-medium">{ticketItem.isUsed ? "Đã dùng" : "Còn hiệu lực"}</span>
          </div>
          <div className="mt-4 flex justify-center rounded-lg bg-white p-3">
            <QRCodeSVG value={ticketItem.qrJwt} size={128} level="H" includeMargin />
          </div>
          <p className="mt-3 line-clamp-2 break-all text-xs text-zinc-500">{ticketItem.qrJwt}</p>
          <button className="btn btn-secondary mt-3 w-full text-xs" onClick={() => void navigator.clipboard.writeText(ticketItem.qrJwt)}>
            <Copy size={14} />
            Copy code
          </button>
        </div>
      ))}
      {order.status !== "PAID" && <p className="text-sm text-zinc-600">Đơn chưa paid nên chưa có QR.</p>}
    </div>
  );
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
      <input className="field h-10 w-full pl-9 text-sm" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function Pager({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="mb-4 flex items-center justify-between gap-3 text-sm text-zinc-600">
      <button className="btn btn-secondary h-9 px-3 text-xs" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Trước
      </button>
      <span>Trang {page}/{totalPages}</span>
      <button className="btn btn-secondary h-9 px-3 text-xs" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        Sau
      </button>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <span className="block text-xs text-zinc-500">{label}</span>
      <b className="mt-1 block break-words text-base leading-6">{value}</b>
    </div>
  );
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  return {
    items: items.slice((safePage - 1) * pageSize, safePage * pageSize),
    totalPages
  };
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function Status({ value }: { value: string }) {
  return <span className="rounded-lg bg-zinc-100 px-3 py-1 text-sm font-medium">{value}</span>;
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="panel p-5">
      <Icon size={18} className="text-zinc-900" />
      <span className="mt-4 block text-sm text-zinc-500">{label}</span>
      <b className="mt-1 block text-2xl">{value}</b>
    </div>
  );
}
