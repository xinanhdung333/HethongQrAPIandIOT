"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Boxes, CheckCircle2, Loader2, PackageCheck, ShoppingBag, Truck, type LucideIcon } from "lucide-react";
import { api, money } from "@/lib/api";
import { DashboardData } from "@/lib/dashboard";

type ProductOrder = DashboardData["rentals"][number];

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

export default function RentalsDashboardPage() {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [returningId, setReturningId] = useState("");
  const [payingId, setPayingId] = useState("");
  const [cancellingId, setCancellingId] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    setActionError("");
    try {
      setData(await api<DashboardData>("/dashboard?view=rentals", { cache: "no-store" }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Khong tai duoc du lieu don san pham.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function returnRental(id: string) {
    setReturningId(id);
    setActionError("");
    try {
      await api(`/rentals/${id}/return`, { method: "PATCH", body: "{}" });
      await load();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Khong the tra thiet bi.");
    } finally {
      setReturningId("");
    }
  }

  async function payRemaining(order: ProductOrder) {
    const remaining = Math.max(0, order.total - (order.depositAmount ?? 0));
    if (!remaining) return;
    setPayingId(order.id);
    setActionError("");
    try {
      const result = await api<{ payment_demo_url: string }>(`/rentals/${order.id}/pay-remaining`, { method: "POST", body: JSON.stringify({ payment_method: "payos_demo" }) });
      if (!result?.payment_demo_url) throw new Error("Khong nhan duoc link thanh toan.");
      window.location.assign(result.payment_demo_url);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Khong the tao thanh toan phan con lai.");
    } finally {
      setPayingId("");
    }
  }

  async function cancelRental(order: ProductOrder) {
    if (!window.confirm("Hủy đơn và hoàn tiền cọc?")) return;
    setCancellingId(order.id); setActionError("");
    try { await api(`/rentals/${order.id}/cancel`, { method: "PATCH", body: "{}" }); await load(); }
    catch (reason) { setActionError(reason instanceof Error ? reason.message : "Khong the huy don thue."); }
    finally { setCancellingId(""); }
  }

  const rentalCount = data.rentals.filter((order) => orderKind(order).key === "rent").length;
  const kitBuyCount = data.rentals.filter((order) => orderKind(order).key === "kit_buy").length;
  const componentCount = data.rentals.filter((order) => orderKind(order).key === "component").length;
  const pending = data.rentals.filter((order) => order.status === "PENDING").length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500">Don mua, thue va linh kien</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Don san pham</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/pages/linh-kien" className="btn btn-secondary bg-white text-sm">
            <ShoppingBag size={16} />
            Mua linh kien
          </Link>
          <Link href="/dashboard/pages/san-pham" className="btn btn-primary text-sm">
            <Truck size={16} />
            Mua / thue thiet bi
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Stat icon={Boxes} label="Tat ca don" value={String(data.rentals.length)} />
        <Stat icon={Truck} label="Thue" value={String(rentalCount)} />
        <Stat icon={PackageCheck} label="Mua ca bo" value={String(kitBuyCount)} />
        <Stat icon={ShoppingBag} label="Linh kien" value={String(componentCount)} />
      </div>

      {loading && <p className="panel mt-6 p-5 text-sm text-zinc-600">Dang tai don san pham...</p>}
      {error && <p className="panel mt-6 border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</p>}
      {actionError && <p className="panel mt-6 border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">{actionError}</p>}

      {!error && (
        <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="grid min-w-[900px] grid-cols-[minmax(220px,1.4fr)_160px_150px_150px_180px] gap-4 border-b border-zinc-200 bg-zinc-50 px-5 py-3 text-xs font-semibold uppercase text-zinc-500">
            <span>San pham</span>
            <span>Phan loai</span>
            <span>Trang thai</span>
            <span>Tong tien</span>
            <span className="text-right">Thao tac</span>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[900px] divide-y divide-zinc-200">
              {data.rentals.map((order) => {
                const kind = orderKind(order);
                const canReturn = kind.key === "rent" && order.status === "ACTIVE";
                const remaining = order.remainingAmount ?? Math.max(0, order.total - (order.depositAmount ?? 0));
                const canPayRemainingToday = !order.startDate || new Date(order.startDate) <= new Date(Date.now() + 24 * 60 * 60 * 1000);
                return (
                  <article key={order.id} className="grid grid-cols-[minmax(220px,1.4fr)_160px_150px_150px_180px] items-center gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <b className="block truncate text-zinc-950">{order.product?.name ?? "SmartQR product"}</b>
                      <p className="mt-1 text-sm text-zinc-600">
                        {order.quantity} san pham
                        {kind.key === "rent" ? `, ${order.duration ?? 0} thang` : ""}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">{order.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN") : "Dang cap nhat"}</p>
                      {order.status === "ACTIVE" && <p className="mt-2 text-xs font-medium text-emerald-700">{remainingRentalText(order.startDate, order.duration)}</p>}
                    </div>

                    <div>
                      <span className={`inline-flex items-center gap-2 rounded-lg px-3 py-1 text-sm font-medium ${kind.className}`}>
                        <kind.icon size={15} />
                        {kind.label}
                      </span>
                    </div>

                    <div>
                      <span className="rounded-lg bg-zinc-100 px-3 py-1 text-sm font-medium">{order.status}</span>
                    </div>

                    <b className="text-sm">{money(order.total)}</b>

                    <div className="flex justify-end gap-2">
                      {kind.key === "rent" ? (
                        <>
                          {order.status === "DEPOSIT_PAID" && order.paymentDueAt && new Date(order.paymentDueAt) > new Date() && <button className="btn btn-secondary text-sm" disabled={cancellingId === order.id} onClick={() => void cancelRental(order)}>{cancellingId === order.id ? <Loader2 size={16} className="animate-spin" /> : null}Hủy và hoàn cọc</button>}
                          {remaining > 0 && canPayRemainingToday && ["ACTIVE", "DEPOSIT_PAID"].includes(order.status) && order.remainingPaymentStatus === "PENDING" && <button className="btn btn-primary text-sm" disabled={payingId === order.id} onClick={() => void payRemaining(order)}>{payingId === order.id ? <Loader2 size={16} className="animate-spin" /> : null}Thanh toan con lai</button>}
                          <button className="btn btn-secondary text-sm" disabled={!canReturn || returningId === order.id} onClick={() => void returnRental(order.id)}>
                          {returningId === order.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                          Tra thiet bi
                          </button>
                        </>
                      ) : (
                        <span className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-500">Khong can tra</span>
                      )}
                    </div>

                    {kind.key === "rent" && (
                      <p className="col-span-5 text-sm text-zinc-500">
                        Gate IDs: {Array.isArray(order.gateIds) && order.gateIds.length ? order.gateIds.join(", ") : "se cap sau paid"}
                      </p>
                    )}
                  </article>
                );
              })}

              {!loading && !data.rentals.length && (
                <p className="p-5 text-sm text-zinc-600">Chua co don san pham nao.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <section className="panel mt-6 p-5">
        <h2 className="font-semibold">Ghi chu phan loai</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Don thue moi co thao tac tra thiet bi. Don mua ca bo va don linh kien la don BUY, sau khi paid thi chi theo doi giao hang/hoan tat, khong tra thiet bi.
          {pending ? ` Hien co ${pending} don dang cho paid.` : ""}
        </p>
      </section>
    </div>
  );
}

function orderKind(order: ProductOrder): { key: "rent" | "kit_buy" | "component"; label: string; icon: LucideIcon; className: string } {
  if (order.type === "RENT") {
    return { key: "rent", label: "Thue", icon: Truck, className: "bg-blue-50 text-blue-700" };
  }
  if (order.product?.type === "COMPONENT") {
    return { key: "component", label: "Linh kien", icon: ShoppingBag, className: "bg-emerald-50 text-emerald-700" };
  }
  return { key: "kit_buy", label: "Mua ca bo", icon: PackageCheck, className: "bg-amber-50 text-amber-700" };
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

function remainingRentalText(startDate?: string, duration?: number) {
  if (!startDate || !duration) return "Thời hạn thuê đang được cập nhật";
  const end = new Date(startDate);
  end.setMonth(end.getMonth() + duration);
  const days = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
  if (!days) return "Hết hạn thuê hôm nay";
  return `Còn ${days} ngày · hết hạn ${end.toLocaleDateString("vi-VN")}`;
}
