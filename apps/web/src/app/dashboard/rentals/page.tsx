"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, Loader2, PackageCheck, Truck, type LucideIcon } from "lucide-react";
import { api, money } from "@/lib/api";
import { DashboardData } from "@/lib/dashboard";

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
  const [returningId, setReturningId] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await api<DashboardData>("/dashboard", { cache: "no-store" }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tải được dữ liệu đơn thuê.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function returnRental(id: string) {
    setReturningId(id);
    try {
      await api(`/rentals/${id}/return`, { method: "PATCH", body: "{}" });
      await load();
    } finally {
      setReturningId("");
    }
  }

  const active = data.rentals.filter((order) => order.status === "ACTIVE").length;
  const pending = data.rentals.filter((order) => order.status === "PENDING").length;
  const returned = data.rentals.filter((order) => order.status === "RETURNED").length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500">Thiết bị đã thuê</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Đơn thuê</h1>
        </div>
        <Link href="/thue-thiet-bi" className="btn btn-primary text-sm">Thuê thêm</Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Stat icon={Truck} label="Tổng đơn" value={String(data.rentals.length)} />
        <Stat icon={CheckCircle2} label="Đang active" value={String(active)} />
        <Stat icon={Clock3} label="Chờ paid" value={String(pending)} />
        <Stat icon={PackageCheck} label="Đã trả" value={String(returned)} />
      </div>

      {loading && <p className="panel mt-6 p-5 text-sm text-zinc-600">Đang tải đơn thuê...</p>}
      {error && <p className="panel mt-6 border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</p>}

      {!error && <div className="mt-6 grid gap-4">
        {data.rentals.map((order) => (
          <article key={order.id} className="panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <b>{order.product?.name ?? "Thiết bị SmartQR"}</b>
                <p className="mt-1 text-sm text-zinc-600">
                  {order.quantity} thiết bị, {order.duration ?? 0} tháng, tổng {money(order.total)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-zinc-100 px-3 py-1 text-sm font-medium">{order.status}</span>
                <button className="btn btn-secondary text-sm" disabled={order.status === "RETURNED" || order.status === "PENDING" || returningId === order.id} onClick={() => void returnRental(order.id)}>
                  {returningId === order.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Trả thiết bị
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-zinc-600 md:grid-cols-2">
              <p>Gate IDs: {Array.isArray(order.gateIds) && order.gateIds.length ? order.gateIds.join(", ") : "sẽ cấp sau paid"}</p>
              <p>Ngày tạo: {order.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN") : "Đang cập nhật"}</p>
            </div>
          </article>
        ))}
        {!loading && !data.rentals.length && <p className="panel p-5 text-sm text-zinc-600">Chưa có đơn thuê. Hãy tạo một đơn SP-01 ở trang Thuê thiết bị.</p>}
      </div>}

      <section className="panel mt-6 p-5">
        <h2 className="font-semibold">Quy trình sau khi paid</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">Đơn chuyển sang ACTIVE, hệ thống cấp gate ID, sinh API Key prefix và dashboard nhận event realtime.</p>
      </section>
    </div>
  );
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
