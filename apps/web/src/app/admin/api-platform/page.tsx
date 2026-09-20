"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Banknote, Eye, Save, Settings, ShieldCheck, Users } from "lucide-react";
import { API_URL, money } from "@/lib/api";

type ApiSettings = { commission_rate_bp: number; quota_warning_thresholds: number[]; quota_burst: { window_minutes: number; threshold_percent: number; enabled: boolean }; feature_flags: Record<string, boolean>; plan_limits: Record<string, { max_keys: number; quota: number; rate_limit: number; price: number }> };
type Payment = { id: string; user_email?: string; rental_app_name?: string; gross_amount: number; commission_amount: number; user_amount: number; status: string; created_at: string };
type PaymentList = { items: Payment[]; total: number; page: number; summary?: { gross_amount: number; commission_amount: number; user_amount: number } };
type PayoutAccount = { id: string; method: string; label?: string; bankName?: string | null; accountNumber?: string | null; accountName: string; walletType?: string | null; walletId?: string | null; isDefault: boolean; status: string };
type AdminUser = { id: string; email: string; role: string; payoutAccounts: PayoutAccount[] };
type Incident = { id: string; title: string; status: string; started_at: string; resolved_at: string | null };

export default function AdminApiPlatformPage() {
  const [settings, setSettings] = useState<ApiSettings | null>(null);
  const [payments, setPayments] = useState<PaymentList>({ items: [], total: 0, page: 1 });
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [paymentPage, setPaymentPage] = useState(1);
  const [revealed, setRevealed] = useState<Record<string, PayoutAccount>>({});

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const authToken = token || window.localStorage.getItem("smartqr_token") || "";
    const res = await fetch(`${API_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}`, ...(init?.headers ?? {}) } });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async function load(page = paymentPage) {
    const saved = window.localStorage.getItem("smartqr_token") ?? "";
    setToken(saved);
    const [settingRes, paymentRes, userRes, incidentRes] = await Promise.all([
      request<{ api_platform: ApiSettings }>("/api/v1/admin/settings"),
      request<PaymentList>(`/api/v1/admin/payments?page=${page}`),
      request<AdminUser[]>("/api/v1/admin/users"),
      request<{ items: Incident[] }>("/api/v1/admin/incidents")
    ]);
    setSettings(settingRes.api_platform);
    setPayments(paymentRes);
    setUsers(userRes);
    setIncidents(incidentRes.items ?? []);
  }

  useEffect(() => { void load().catch(error => setMessage(error instanceof Error ? error.message : "Khong tai duoc admin API platform.")); }, []);

  async function save(formData: FormData) {
    if (!confirm("Luu setting lien quan tien/quota? Giao dich cu van giu snapshot, giao dich moi se dung setting moi.")) return;
    const burstWindow = Number(formData.get("quota_burst_window"));
    const burstThreshold = Number(formData.get("quota_burst_threshold"));
    if (!Number.isInteger(burstWindow) || burstWindow < 1 || burstWindow > 1440) {
      setMessage("Cửa sổ quota-burst phải là số nguyên từ 1 đến 1440 phút.");
      return;
    }
    if (!Number.isInteger(burstThreshold) || burstThreshold < 1 || burstThreshold > 100) {
      setMessage("Ngưỡng quota-burst phải là số nguyên từ 1 đến 100%.");
      return;
    }
    await request("/api/v1/admin/settings", { method: "PATCH", body: JSON.stringify({
      commission_rate_bp: Number(formData.get("commission_rate_bp")),
      quota_warning_thresholds: String(formData.get("quota_warning_thresholds") ?? "80,95").split(",").map((item) => Number(item.trim())).filter(Number.isFinite),
      quota_burst: { window_minutes: burstWindow, threshold_percent: burstThreshold, enabled: formData.get("quota_burst_enabled") === "on" },
      plan_limits: {
        starter: { max_keys: Number(formData.get("starter_max_keys")), quota: Number(formData.get("starter_quota")), rate_limit: Number(formData.get("starter_rate")), price: Number(formData.get("starter_price")) },
        business: { max_keys: Number(formData.get("business_max_keys")), quota: Number(formData.get("business_quota")), rate_limit: Number(formData.get("business_rate")), price: Number(formData.get("business_price")) }
      },
      feature_flags: { api_explorer: formData.get("api_explorer") === "on", bulk_create: formData.get("bulk_create") === "on", pay_as_you_go: formData.get("pay_as_you_go") === "on" }
    }) });
    setMessage("Da luu system settings.");
    await load();
  }

  async function loadPaymentPage(page: number) {
    const next = Math.max(1, page);
    setPaymentPage(next);
    await load(next);
  }

  async function markPaid(id: string) {
    await request(`/api/v1/admin/payments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: "PAYOUT_COMPLETED", note: "Manual payout completed from admin UI" }) });
    await load();
  }

  async function revealPayout(id: string) {
    const result = await request<{ account: PayoutAccount }>(`/api/v1/admin/payout-accounts/${id}/reveal`, { method: "POST" });
    setRevealed((current) => ({ ...current, [id]: result.account }));
  }

  async function createIncident(formData: FormData) {
    await request("/api/v1/admin/incidents", { method: "POST", body: JSON.stringify({ title: String(formData.get("title") ?? "").trim(), status: formData.get("status") || "investigating" }) });
    setMessage("Da tao incident public.");
    await load();
  }

  async function resolveIncident(id: string) {
    await request(`/api/v1/admin/incidents/${id}`, { method: "PATCH", body: JSON.stringify({ status: "resolved" }) });
    await load();
  }

  return (
    <main className="shell py-8 md:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-zinc-500">Admin</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">API platform settings va payments</h1></div><Link href="/admin" className="btn btn-secondary text-sm"><ShieldCheck size={16} /> Admin console</Link></div>
      {message && <p className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">{message}</p>}
      {!settings && <p className="mt-6 text-sm text-zinc-500">Dang tai settings...</p>}
      {settings && <form action={save} className="panel mt-6 grid gap-5 p-5"><div className="flex items-center gap-2"><Settings size={18} /><h2 className="font-semibold">System settings</h2></div><div className="grid gap-3 md:grid-cols-2"><label className="grid gap-1 text-sm">Commission basis points<input name="commission_rate_bp" className="field" type="number" defaultValue={settings.commission_rate_bp} /></label><label className="grid gap-1 text-sm">Quota warning thresholds<input name="quota_warning_thresholds" className="field" defaultValue={settings.quota_warning_thresholds.join(",")} placeholder="80,95" /></label></div><section className="rounded-lg border border-zinc-200 p-4"><h3 className="font-semibold">Quota-burst warning</h3><p className="mt-1 text-sm text-zinc-600">Cảnh báo khi lượng tạo QR trong cửa sổ ngắn tăng bất thường.</p><div className="mt-3 grid gap-3 md:grid-cols-3"><label className="grid gap-1 text-sm">Cửa sổ (phút)<input name="quota_burst_window" className="field" type="number" min="1" max="1440" defaultValue={settings.quota_burst.window_minutes} /></label><label className="grid gap-1 text-sm">Ngưỡng (% quota)<input name="quota_burst_threshold" className="field" type="number" min="1" max="100" defaultValue={settings.quota_burst.threshold_percent} /></label><label className="flex items-end gap-2 pb-2 text-sm"><input name="quota_burst_enabled" type="checkbox" defaultChecked={settings.quota_burst.enabled} /> Bật cảnh báo</label></div></section><div className="grid gap-4 md:grid-cols-2">{(["starter", "business"] as const).map(plan => <section key={plan} className="rounded-lg border border-zinc-200 p-4"><h3 className="font-semibold capitalize">{plan}</h3><div className="mt-3 grid gap-3 md:grid-cols-2"><input name={`${plan}_max_keys`} className="field" type="number" defaultValue={settings.plan_limits[plan].max_keys} placeholder="max keys" /><input name={`${plan}_quota`} className="field" type="number" defaultValue={settings.plan_limits[plan].quota} placeholder="quota" /><input name={`${plan}_rate`} className="field" type="number" defaultValue={settings.plan_limits[plan].rate_limit} placeholder="rate" /><input name={`${plan}_price`} className="field" type="number" defaultValue={settings.plan_limits[plan].price} placeholder="price" /></div></section>)}</div><div className="flex flex-wrap gap-4 text-sm"><label><input name="api_explorer" type="checkbox" defaultChecked={settings.feature_flags.api_explorer} /> API explorer</label><label><input name="bulk_create" type="checkbox" defaultChecked={settings.feature_flags.bulk_create} /> Bulk create</label><label><input name="pay_as_you_go" type="checkbox" defaultChecked={settings.feature_flags.pay_as_you_go} /> Pay-as-you-go/payment split</label></div><button className="btn btn-primary w-fit text-sm"><Save size={16} /> Luu settings</button></form>}

      <section className="panel mt-6 overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 p-5"><div className="flex items-center gap-2"><Banknote size={18} /><h2 className="font-semibold">Quan ly giao dich</h2></div><div className="flex items-center gap-2 text-sm"><button className="btn btn-secondary text-xs" disabled={paymentPage <= 1} onClick={() => void loadPaymentPage(paymentPage - 1)}>Prev</button><span>Page {payments.page ?? paymentPage} / {Math.max(1, Math.ceil(payments.total / 50))}</span><button className="btn btn-secondary text-xs" disabled={(payments.page ?? paymentPage) >= Math.ceil(payments.total / 50)} onClick={() => void loadPaymentPage(paymentPage + 1)}>Next</button></div></div><div className="grid gap-4 border-b border-zinc-200 p-5 md:grid-cols-3"><Stat label="Gross" value={money(payments.summary?.gross_amount ?? 0)} /><Stat label="Commission" value={money(payments.summary?.commission_amount ?? 0)} /><Stat label="User amount" value={money(payments.summary?.user_amount ?? 0)} /></div><div className="overflow-auto"><table className="w-full min-w-[920px] text-left text-sm"><tbody className="divide-y divide-zinc-200">{payments.items.map(payment => <tr key={payment.id}><td className="px-5 py-4">{new Date(payment.created_at).toLocaleString("vi-VN")}<p className="text-xs text-zinc-500">{payment.id}</p></td><td className="px-5 py-4">{payment.user_email}<p className="text-xs text-zinc-500">{payment.rental_app_name}</p></td><td className="px-5 py-4">{money(payment.gross_amount)}</td><td className="px-5 py-4">{money(payment.commission_amount)}</td><td className="px-5 py-4 text-emerald-700">{money(payment.user_amount)}</td><td className="px-5 py-4">{payment.status}</td><td className="px-5 py-4"><button className="btn btn-secondary text-sm" disabled={payment.status === "PAYOUT_COMPLETED"} onClick={() => void markPaid(payment.id)}>Mark payout completed</button></td></tr>)}{!payments.items.length && <tr><td className="px-5 py-6 text-zinc-500">Chua co payment.</td></tr>}</tbody></table></div></section>

      <section className="panel mt-6 p-5"><div className="flex items-center gap-2"><Users size={18} /><h2 className="font-semibold">User payout accounts</h2></div><div className="mt-4 grid gap-3">{users.map((user) => <article key={user.id} className="rounded-lg border border-zinc-200 p-4"><b>{user.email}</b><div className="mt-3 grid gap-2">{user.payoutAccounts.map((account) => <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-zinc-50 p-3 text-sm"><span>{revealed[account.id]?.accountNumber || revealed[account.id]?.walletId || account.label || account.accountName}</span><button className="btn btn-secondary text-xs" onClick={() => void revealPayout(account.id)}><Eye size={14} /> Reveal</button></div>)}{!user.payoutAccounts.length && <p className="text-sm text-zinc-500">Chua co payout account.</p>}</div></article>)}</div></section>

      <section className="panel mt-6 p-5"><div className="flex items-center gap-2"><AlertTriangle size={18} /><h2 className="font-semibold">Status incidents</h2></div><form action={createIncident} className="mt-4 flex flex-wrap gap-2"><input name="title" className="field min-w-[260px]" placeholder="Tieu de incident public" required /><select name="status" className="field w-44"><option value="investigating">investigating</option><option value="identified">identified</option><option value="monitoring">monitoring</option><option value="resolved">resolved</option></select><button className="btn text-sm">Tao incident</button></form><div className="mt-4 grid gap-3">{incidents.map((incident) => <article key={incident.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 p-4 text-sm"><div><b>{incident.title}</b><p className="text-xs text-zinc-500">{incident.status} - {new Date(incident.started_at).toLocaleString("vi-VN")}</p></div><button className="btn btn-secondary text-xs" disabled={incident.status === "resolved"} onClick={() => void resolveIncident(incident.id)}>Resolve</button></article>)}{!incidents.length && <p className="text-sm text-zinc-500">Chua co incident.</p>}</div></section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-zinc-200 p-4"><span className="text-sm text-zinc-500">{label}</span><b className="mt-2 block text-xl">{value}</b></div>; }
