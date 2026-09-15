"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RealtimeStatus } from "@/components/realtime-status";
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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api<DashboardData>("/dashboard", { cache: "no-store" })
      .then(setData)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Không tải được dashboard."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="panel p-6 text-sm text-zinc-600">Đang tải dashboard...</div>;
  }

  if (error) {
    return (
      <div className="panel p-6">
        <h1 className="text-xl font-semibold">Không tải được dashboard</h1>
        <p className="mt-2 text-sm text-zinc-600">{error}</p>
      </div>
    );
  }

  const revenue = data.ticketOrders.reduce((sum, order) => sum + (order.status === "PAID" ? order.totalAmount : 0), 0);
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="panel p-5"><span className="text-sm text-zinc-500">Đơn thuê</span><b className="mt-2 block text-2xl">{data.rentals.length}</b></div>
        <div className="panel p-5"><span className="text-sm text-zinc-500">Show đang chạy</span><b className="mt-2 block text-2xl">{data.shows.length}</b></div>
        <div className="panel p-5"><span className="text-sm text-zinc-500">Doanh thu vé</span><b className="mt-2 block text-2xl">{money(revenue)}</b></div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="panel p-5">
          <h2 className="font-semibold">Thao tác nhanh</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/thue-thiet-bi" className="btn btn-primary text-sm">Thuê SP-01</Link>
            <Link href="/tao-show" className="btn btn-secondary text-sm">Tạo show</Link>
            <Link href="/dashboard/scan" className="btn btn-secondary text-sm">Quét thử</Link>
          </div>
        </div>
        <RealtimeStatus showIds={data.shows.map((show) => show.id)} />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="panel p-5">
          <h2 className="font-semibold">Luồng demo gợi ý</h2>
          <ol className="mt-4 grid gap-3 text-sm text-zinc-600">
            <li>1. Thuê SP-01 để sinh API Key demo.</li>
            <li>2. Tạo show white-label và mở link public.</li>
            <li>3. Mua vé demo, chờ PayOS mock paid sau 5 giây.</li>
            <li>4. Vào Vé QR rồi quét thử ở cổng gate-main.</li>
          </ol>
        </section>
        <section className="panel p-5">
          <h2 className="font-semibold">Trạng thái bảo mật</h2>
          <div className="mt-4 grid gap-3 text-sm text-zinc-600">
            <p>API Key được hash SHA-256 trước khi lưu.</p>
            <p>QR JWT có jti và bị revoke sau lần verify đầu tiên.</p>
            <p>Rate limit verify đang đặt 10 req/s.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
