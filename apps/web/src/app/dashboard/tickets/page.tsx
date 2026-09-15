"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Search, Ticket } from "lucide-react";
import { api, money } from "@/lib/api";
import { DashboardData, DashboardTicketOrder } from "@/lib/dashboard";

const PAGE_SIZE = 8;

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

export default function TicketsPage() {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [openOrderId, setOpenOrderId] = useState("");

  useEffect(() => {
    setError("");
    void api<DashboardData>("/dashboard", { cache: "no-store" })
      .then((result) => setData({
        ...result,
        purchasedTicketOrders: result.purchasedTicketOrders ?? []
      }))
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Không tải được dữ liệu vé.");
      })
      .finally(() => setLoading(false));
  }, []);

  const orders = data.purchasedTicketOrders ?? [];
  const filteredOrders = useMemo(() => {
    const keyword = normalize(query);
    if (!keyword) return orders;
    return orders.filter((order) => normalize(`${order.show.name} ${order.buyerName ?? ""} ${order.buyerEmail ?? ""}`).includes(keyword));
  }, [orders, query]);
  const pagedOrders = paginate(filteredOrders, page, PAGE_SIZE);
  const openOrder = orders.find((order) => order.id === openOrderId);
  const totalTickets = orders.reduce((sum, order) => sum + order.quantity, 0);
  const usedTickets = orders.reduce((sum, order) => sum + order.tickets.filter((ticketItem) => ticketItem.isUsed).length, 0);

  useEffect(() => {
    setPage(1);
  }, [query]);

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500">Vé cá nhân</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Vé đã mua</h1>
        </div>
        <Link href="/dashboard/scan" className="btn btn-secondary text-sm">
          <Ticket size={16} />
          Quét thử
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Stat label="Đơn đã mua" value={String(orders.length)} />
        <Stat label="Tổng vé" value={String(totalTickets)} />
        <Stat label="Đã check-in" value={`${usedTickets}/${totalTickets}`} />
      </div>

      {loading && <p className="panel mt-6 p-5 text-sm text-zinc-600">Đang tải vé...</p>}
      {error && <p className="panel mt-6 border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</p>}

      {!error && (
        <section className="panel mt-6 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-5 py-4">
            <div>
              <h2 className="font-semibold">Danh sách vé của tôi</h2>
              <p className="mt-1 text-sm text-zinc-600">Vé mua bằng email tài khoản hiện tại sẽ hiện ở đây.</p>
            </div>
            <div className="w-full sm:w-80">
              <SearchField value={query} onChange={setQuery} placeholder="Tìm show, email..." />
            </div>
          </div>

          <div className="overflow-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Show</th>
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
                        <b>{order.show.name}</b>
                        {order.show.startAt && <p className="mt-1 text-xs text-zinc-500">{new Date(order.show.startAt).toLocaleString("vi-VN")}</p>}
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
            {!loading && !filteredOrders.length && <p className="p-5 text-sm text-zinc-600">Chưa có vé phù hợp.</p>}
          </div>

          <div className="border-t border-zinc-200 px-5 py-4">
            <Pager page={page} totalPages={pagedOrders.totalPages} onPageChange={setPage} />
            {openOrder && <TicketQrCards order={openOrder} />}
          </div>
        </section>
      )}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-5">
      <span className="block text-sm text-zinc-500">{label}</span>
      <b className="mt-2 block text-2xl">{value}</b>
    </div>
  );
}
