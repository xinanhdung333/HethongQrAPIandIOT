"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, Code2, ExternalLink, KeyRound, Loader2, PackageOpen, ShieldCheck } from "lucide-react";
import { api, money } from "@/lib/api";
import { DashboardData } from "@/lib/dashboard";

const emptyData: DashboardData = { rentals: [], apiRentals: [], shows: [], apiKeys: [], ticketOrders: [], purchasedTicketOrders: [], payouts: [], tickets: [], externalQrCodes: [] };

export default function ApiRentalDashboardPage() {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api<DashboardData>("/dashboard?view=api-rentals", { cache: "no-store" })
      .then((result) => { if (active) setData(result); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Không tải được đơn thuê API."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const activeCount = data.apiRentals.filter((item) => item.status === "ACTIVE").length;
  const pendingCount = data.apiRentals.filter((item) => item.status === "PENDING").length;
  const totalQuota = data.apiRentals.reduce((sum, item) => sum + item.quota, 0);

  return <main className="mx-auto min-w-0 max-w-[1200px] py-3 md:py-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-zinc-500">Developer subscriptions</p><h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Đơn thuê API</h1><p className="mt-2 text-sm text-zinc-600">Theo dõi gói dịch vụ, quota và API key đã được cấp.</p></div><Link href="/dashboard/pages/thue-api" className="btn btn-primary text-sm"><Code2 size={16} />Thuê API mới</Link></div>

    <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat icon={Code2} label="Tổng đơn" value={String(data.apiRentals.length)} tone="violet" /><Stat icon={CheckCircle2} label="Đang hoạt động" value={String(activeCount)} tone="emerald" /><Stat icon={Clock3} label="Chờ thanh toán" value={String(pendingCount)} tone="amber" /><Stat icon={ShieldCheck} label="Tổng quota" value={totalQuota.toLocaleString("vi-VN")} tone="blue" /></div>

    {loading && <div className="panel mt-6 flex items-center gap-3 p-5 text-sm text-zinc-600"><Loader2 size={17} className="animate-spin" />Đang tải đơn thuê API...</div>}
    {error && <div className="panel mt-6 border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>}

    {!loading && !error && <section className="mt-6 grid gap-4">
      {data.apiRentals.map((rental) => <article key={rental.id} className="panel overflow-hidden"><div className="flex flex-col gap-4 border-b border-zinc-200 p-5 md:flex-row md:items-center md:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-semibold">{rental.appName}</h2><Status value={rental.status} /></div><p className="mt-1 truncate text-sm text-zinc-500">{rental.website || "Chưa khai báo website"}</p></div><div className="flex flex-wrap gap-2"><Link href="/dashboard/api-keys" className="btn btn-secondary h-9 bg-white text-xs"><KeyRound size={14} />Quản lý key</Link>{rental.website && <a href={rental.website} target="_blank" rel="noreferrer" className="btn btn-secondary h-9 bg-white text-xs"><ExternalLink size={14} />Mở website</a>}</div></div><div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4"><Detail label="Gói dịch vụ" value={rental.plan.toUpperCase()} /><Detail label="Thời hạn" value={`${rental.duration} tháng`} /><Detail label="Quota" value={`${rental.quota.toLocaleString("vi-VN")} lượt`} /><Detail label="Tổng phí" value={money(rental.total)} /></div><div className="flex flex-col gap-3 bg-zinc-50 px-5 py-4 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between"><span>Scopes: {rental.scopes?.length ? rental.scopes.join(" · ") : "Chưa cấp"}</span><span>API key: {rental.apiKeyPrefix ? `${rental.apiKeyPrefix}••••••••` : rental.status === "ACTIVE" ? "Chờ cấp key" : "Cấp sau thanh toán"}</span></div></article>)}
      {!data.apiRentals.length && <div className="panel grid min-h-80 place-items-center p-8 text-center"><div><div className="mx-auto grid size-12 place-items-center rounded-xl bg-violet-50 text-violet-700"><PackageOpen size={22} /></div><h2 className="mt-4 font-semibold">Chưa có đơn thuê API</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">Chọn gói Starter hoặc Business để nhận API key và bắt đầu tích hợp.</p><Link href="/dashboard/pages/thue-api" className="btn btn-primary mt-5 text-sm">Xem gói API</Link></div></div>}
    </section>}
  </main>;
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Code2; label: string; value: string; tone: "violet" | "emerald" | "amber" | "blue" }) { const color = tone === "violet" ? "bg-violet-50 text-violet-700" : tone === "emerald" ? "bg-emerald-50 text-emerald-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"; return <div className="panel min-w-0 p-4"><span className={`grid size-8 place-items-center rounded-lg ${color}`}><Icon size={16} /></span><span className="mt-3 block truncate text-xs text-zinc-500">{label}</span><b className="mt-1 block truncate text-xl tracking-tight">{value}</b></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><span className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</span><p className="mt-1 font-semibold text-zinc-800">{value}</p></div>; }
function Status({ value }: { value: string }) { const style = value === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : value === "PENDING" ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-600"; const label = value === "ACTIVE" ? "Đang hoạt động" : value === "PENDING" ? "Chờ thanh toán" : value; return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${style}`}>{label}</span>; }
