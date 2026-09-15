"use client";

import { useEffect, useState } from "react";
import { Banknote, RefreshCw } from "lucide-react";
import { api, money } from "@/lib/api";

type Payment = { id: string; rental_id: string; rental_app_name?: string; qr_code_id: string | null; gross_amount: number; commission_rate_bp: number; commission_amount: number; user_amount: number; status: string; created_at: string; payout_completed_at: string | null; payout_account_snapshot?: Record<string, unknown> | null };

type PaymentList = { items: Payment[]; total: number; page: number };

export default function DashboardPaymentsPage() {
  const [data, setData] = useState<PaymentList>({ items: [], total: 0, page: 1 });
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    setData(await api<PaymentList>(`/api/v1/developer/payments${qs}`, { cache: "no-store" }));
  }

  useEffect(() => { void load().catch(error => setMessage(error instanceof Error ? error.message : "Khong tai duoc giao dich.")); }, [status]);

  const totalGross = data.items.reduce((sum, item) => sum + item.gross_amount, 0);
  const totalCommission = data.items.reduce((sum, item) => sum + item.commission_amount, 0);
  const totalUser = data.items.reduce((sum, item) => sum + item.user_amount, 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500">Payment split</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Giao dich va payout</h1>
          <p className="mt-2 text-sm text-zinc-600">Moi payment luu snapshot commission va tai khoan payout tai thoi diem phat sinh.</p>
        </div>
        <button className="btn btn-secondary text-sm" onClick={() => void load()}><RefreshCw size={16} /> Refresh</button>
      </div>
      {message && <p className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</p>}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Stat label="Gross" value={money(totalGross)} />
        <Stat label="Commission" value={money(totalCommission)} />
        <Stat label="User amount" value={money(totalUser)} />
      </div>

      <section className="panel mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 p-5">
          <h2 className="font-semibold">Danh sach giao dich</h2>
          <select className="field max-w-60" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Tat ca status</option>
            <option value="PAYOUT_PROCESSING">Payout processing</option>
            <option value="PAYOUT_COMPLETED">Payout completed</option>
            <option value="FAILED">Failed</option>
            <option value="DISPUTED">Disputed</option>
          </select>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500"><tr><th className="px-5 py-3">Ngay</th><th className="px-5 py-3">Rental</th><th className="px-5 py-3">Gross</th><th className="px-5 py-3">Phi</th><th className="px-5 py-3">Nhan</th><th className="px-5 py-3">Payout</th><th className="px-5 py-3">Status</th></tr></thead>
            <tbody className="divide-y divide-zinc-200">
              {data.items.map(payment => (
                <tr key={payment.id}>
                  <td className="px-5 py-4">{new Date(payment.created_at).toLocaleString("vi-VN")}<p className="mt-1 text-xs text-zinc-500">{payment.id}</p></td>
                  <td className="px-5 py-4">{payment.rental_app_name ?? payment.rental_id}<p className="mt-1 text-xs text-zinc-500">QR {payment.qr_code_id ?? "-"}</p></td>
                  <td className="px-5 py-4 font-semibold">{money(payment.gross_amount)}</td>
                  <td className="px-5 py-4">{money(payment.commission_amount)}<p className="text-xs text-zinc-500">{payment.commission_rate_bp / 100}%</p></td>
                  <td className="px-5 py-4 font-semibold text-emerald-700">{money(payment.user_amount)}</td>
                  <td className="px-5 py-4"><Banknote size={16} className="mb-1" />{String(payment.payout_account_snapshot?.["account_name"] ?? "Chua co payout")}</td>
                  <td className="px-5 py-4">{payment.status}</td>
                </tr>
              ))}
              {!data.items.length && <tr><td className="px-5 py-6 text-zinc-500">Chua co payment transaction.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="panel p-5"><span className="text-sm text-zinc-500">{label}</span><b className="mt-2 block text-2xl tracking-tight">{value}</b></div>;
}
