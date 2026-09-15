"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, Download, Eye, KeyRound, RefreshCw, RotateCcw, Search, ShieldCheck, Trash2, Webhook } from "lucide-react";
import { API_URL, api, money } from "@/lib/api";

const fullScopes = ["qr:create", "qr:read", "ticket:verify"];
const sections = [
  { id: "keys", label: "API keys", icon: KeyRound },
  { id: "secrets", label: "Rental secrets", icon: ShieldCheck },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "webhooks", label: "Webhook", icon: Webhook },
  { id: "audit", label: "Audit logs", icon: Download }
] as const;
type SectionId = typeof sections[number]["id"];

type DeveloperKey = { id: string; prefix: string; quota: number; scopes: string[]; rentalId: string | null; status: string; isTest: boolean; allowedIps: string[]; rateLimit: number; revokeAt: string | null; createdAt?: string };
type DeveloperRental = { id: string; appName: string; callbackUrl: string | null; plan: string; quota: number; status: string; signingEnabled: boolean; billingMode: string; apiKeyPrefix: string | null; createdAt?: string };
type DeveloperOverview = { keys: DeveloperKey[]; rentals: DeveloperRental[]; notifications: Array<{ id: string; kind: string; payload: Record<string, unknown>; createdAt: string }> };
type Analytics = { totals: { requests: number; qr_created: number; verify_success: number; verify_failed: number; billed_amount: number }; daily: Array<{ date: string; requests: number; qr_created: number; verify_success: number; verify_failed: number }> };
type WebhookLog = { id: string; event: string; status: string; attempts: number; manualReplayCount: number; createdAt: string; logs: Array<{ attempt: number; statusCode: number | null; error: string | null; createdAt: string }> };
type AuditRow = { id: string; method: string; endpoint: string; statusCode: number; durationMs: number; ip: string | null; error: string | null; isTest: boolean; createdAt: string };
type OfflineSettings = { tenant_id: string; offline_capable: boolean; enabled_at: string | null };

type Audit = { items: AuditRow[]; total: number; page: number };
type AuditFilter = { endpoint: string; status: string; from: string; to: string; is_test: string };
const emptyAuditFilter: AuditFilter = { endpoint: "", status: "", from: "", to: "", is_test: "" };

export default function ApiKeysPage() {
  const [overview, setOverview] = useState<DeveloperOverview>({ keys: [], rentals: [], notifications: [] });
  const [analytics, setAnalytics] = useState<Analytics>({ totals: { requests: 0, qr_created: 0, verify_success: 0, verify_failed: 0, billed_amount: 0 }, daily: [] });
  const [webhooks, setWebhooks] = useState<WebhookLog[]>([]);
  const [audit, setAudit] = useState<Audit>({ items: [], total: 0, page: 1 });
  const [message, setMessage] = useState("");
  const [rawKey, setRawKey] = useState("");
  const [rawKeyRevokeAt, setRawKeyRevokeAt] = useState<string | null>(null);
  const [rotateTarget, setRotateTarget] = useState<DeveloperKey | null>(null);
  const [rotatePassword, setRotatePassword] = useState("");
  const [rotating, setRotating] = useState(false);
  const [secret, setSecret] = useState<Record<string, string | null>>({});
  const [auditFilter, setAuditFilter] = useState<AuditFilter>(emptyAuditFilter);
  const [ipDrafts, setIpDrafts] = useState<Record<string, string[]>>({});
  const [activeSection, setActiveSection] = useState<SectionId>("keys");
  const [keySearch, setKeySearch] = useState("");
  const [keyPage, setKeyPage] = useState(1);
  const [keyPageSize, setKeyPageSize] = useState(10);
  const [offlineSettings, setOfflineSettings] = useState<OfflineSettings | null>(null);
  const [offlineRawKey, setOfflineRawKey] = useState("");
  const [offlineLoading, setOfflineLoading] = useState(false);

  async function load(nextAuditFilter = auditFilter) {
    const [nextOverview, nextAnalytics, nextWebhooks, nextAudit] = await Promise.all([
      api<DeveloperOverview>("/api/v1/developer/overview", { cache: "no-store" }),
      api<Analytics>("/api/v1/developer/analytics", { cache: "no-store" }),
      api<{ items: WebhookLog[] }>("/api/v1/developer/webhooks", { cache: "no-store" }),
      api<Audit>(`/api/v1/developer/audit${auditQs(nextAuditFilter)}`, { cache: "no-store" })
    ]);
    setOverview(nextOverview);
    setAnalytics(nextAnalytics);
    setWebhooks(nextWebhooks.items ?? []);
    setAudit(nextAudit);
  }

  function auditQs(filter = auditFilter) {
    const params = new URLSearchParams();
    Object.entries(filter).forEach(([key, value]) => { if (value) params.set(key, value); });
    return params.toString() ? `?${params}` : "";
  }

  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "Khong tai duoc developer console.")); }, []);
  useEffect(() => {
    const setSection = (value: string) => {
      if (sections.some((section) => section.id === value)) setActiveSection(value as SectionId);
    };
    const syncHash = () => {
      const hash = window.location.hash.replace("#", "");
      setSection(hash);
    };
    const syncSectionEvent = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (typeof detail === "string") setSection(detail);
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("smartqr:api-section", syncSectionEvent);
    return () => {
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("smartqr:api-section", syncSectionEvent);
    };
  }, []);
  useEffect(() => setKeyPage(1), [keySearch, keyPageSize]);

  async function updateScopes(key: DeveloperKey, scopes: string[]) {
    if (!scopes.length) return setMessage("Moi key can co it nhat mot scope.");
    const result = await api<{ key: DeveloperKey }>(`/api/v1/developer/keys/${key.id}`, { method: "PATCH", body: JSON.stringify({ scopes }) });
    setOverview((current) => ({ ...current, keys: current.keys.map((item) => item.id === key.id ? result.key : item) }));
  }

  async function saveIps(key: DeveloperKey, allowed_ips: string[]) {
    if (!allowed_ips.length && !confirm("IP whitelist dang rong nghia la key chap nhan moi IP. Ban chac chu?")) return;
    const result = await api<{ key: DeveloperKey }>(`/api/v1/developer/keys/${key.id}`, { method: "PATCH", body: JSON.stringify({ allowed_ips }) });
    setOverview((current) => ({ ...current, keys: current.keys.map((item) => item.id === key.id ? result.key : item) }));
    setIpDrafts((current) => ({ ...current, [key.id]: result.key.allowedIps }));
  }

  function rotateKey(key: DeveloperKey) {
    setMessage("");
    setRotatePassword("");
    setRotateTarget(key);
  }

  async function submitRotate() {
    if (!rotateTarget || !rotatePassword) {
      setMessage("Vui long nhap mat khau hien tai de cap lai key.");
      return;
    }
    setRotating(true);
    try {
      const result = await api<{ api_key_once: string; key: DeveloperKey }>(`/api/v1/developer/keys/${rotateTarget.id}/rotate`, { method: "POST", body: JSON.stringify({ password: rotatePassword }) });
      setRawKey(result.api_key_once);
      setRawKeyRevokeAt(result.key.revokeAt);
      setRotateTarget(null);
      setRotatePassword("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Khong cap lai duoc API key.");
    } finally {
      setRotating(false);
    }
  }

  async function createTestKey(rental: DeveloperRental) {
    setMessage("");
    const result = await api<{ api_key_once: string }>(`/api/v1/developer/rentals/${rental.id}/test-key`, { method: "POST" });
    setRawKey(result.api_key_once);
    await load();
  }

  async function revokeKey(key: DeveloperKey) {
    setMessage("");
    if (key.status === "revoked") return setMessage("Key nay da bi revoke roi.");
    if (!confirm(`Revoke key ${key.prefix}...? Key nay se ngung hoat dong ngay lap tuc.`)) return;
    try {
      await api(`/api/v1/developer/keys/${key.id}/revoke`, { method: "POST" });
      setMessage(`Da revoke key ${key.prefix}...`);
      await load();
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Khong revoke duoc API key.";
      setMessage(detail === "Login required" ? "Phien dang nhap het han. Hay dang nhap lai roi thu revoke key." : detail);
    }
  }

  async function createVerifyKey(rental: DeveloperRental) {
    setMessage("");
    try {
      const result = await api<{ api_key_once: string }>(`/api/v1/developer/rentals/${rental.id}/keys`, { method: "POST", body: JSON.stringify({ scopes: ["ticket:verify"] }) });
      setRawKey(result.api_key_once);
      setMessage(`Da tao verify key cho ${rental.appName}. Raw key chi hien mot lan.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Khong tao duoc verify key.");
    }
  }

  async function toggleSigning(rental: DeveloperRental) {
    await api(`/api/v1/developer/rentals/${rental.id}/settings`, { method: "PATCH", body: JSON.stringify({ signing_enabled: !rental.signingEnabled }) });
    await load();
  }

  async function revealSecrets(rental: DeveloperRental) {
    setMessage("");
    const revealPassword = window.prompt(`Nhap mat khau hien tai de hien secret cua ${rental.appName}:`);
    if (!revealPassword) return setMessage("Da huy hien secret.");
    if (!confirm("Secret chi nen copy vao noi an toan va khong chia se qua chat/email. Tiep tuc reveal?")) return;
    const result = await api<{ signing_secret: string | null; webhook_secret: string | null }>(`/api/v1/developer/rentals/${rental.id}/secrets/reveal`, { method: "POST", body: JSON.stringify({ password: revealPassword }) });
    setSecret({ [`${rental.id}:signing`]: result.signing_secret, [`${rental.id}:webhook`]: result.webhook_secret });
    setMessage("Secret da hien thi. Hay copy mot lan va an lai sau khi luu vao vault.");
  }

  async function rotateSecret(rental: DeveloperRental, kind: "signing" | "webhook") {
    setMessage("");
    const rotatePassword = window.prompt(`Nhap mat khau hien tai de rotate ${kind} secret cua ${rental.appName}:`);
    if (!rotatePassword) return setMessage(`Da huy rotate ${kind} secret.`);
    if (!confirm(`Rotate ${kind} secret? Secret moi chi hien mot lan, secret cu se khong con dung cho request/webhook moi.`)) return;
    const result = await api<{ secret_once: string }>(`/api/v1/developer/rentals/${rental.id}/secrets`, { method: "POST", body: JSON.stringify({ kind, password: rotatePassword }) });
    setSecret({ [`${rental.id}:${kind}`]: result.secret_once });
    setMessage(`${kind} secret moi chi hien mot lan. Hay copy vao vault ngay.`);
    await load();
  }

  async function retryWebhook(id: string) {
    if (!confirm("Replay webhook nay? Endpoint cua ban co the nhan lai event trung lap.")) return;
    await api(`/api/v1/developer/webhooks/${id}/retry`, { method: "POST" });
    setMessage("Da dua webhook vao hang replay.");
    await load();
  }

  async function copyOnce(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setMessage(`Da copy ${label}. Gia tri nay dang hien tren man hinh, hay an lai neu da luu xong.`);
  }

  function clearSecrets(rentalId: string) {
    setSecret((current) => {
      const next = { ...current };
      delete next[`${rentalId}:signing`];
      delete next[`${rentalId}:webhook`];
      return next;
    });
  }

  function exportAudit() {
    const token = window.localStorage.getItem("smartqr_token") ?? "";
    fetch(`${API_URL}/api/v1/developer/audit/export${auditQs()}`, { headers: { Authorization: `Bearer ${token}` } }).then(async res => {
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "smartqr-audit.csv"; a.click(); URL.revokeObjectURL(url);
    }).catch(error => setMessage(error instanceof Error ? error.message : "Khong export duoc CSV."));
  }

  async function fetchOfflineSettings() {
    if (!offlineRawKey.trim()) return setMessage("Dan raw API key co scope qr:create truoc.");
    setOfflineLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/gates/tenant-settings`, { headers: { "x-api-key": offlineRawKey.trim() } });
      if (!response.ok) throw new Error(await response.text());
      setOfflineSettings(await response.json() as OfflineSettings);
      setMessage("Da tai trang thai quet offline cua tenant.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Khong tai duoc trang thai offline.");
    } finally {
      setOfflineLoading(false);
    }
  }

  async function enableTenantOffline() {
    if (!offlineRawKey.trim()) return setMessage("Dan raw API key co scope qr:create truoc.");
    if (!confirm("Sau khi bat, khong the tat lai. Ve phat hanh sau thoi diem nay se co them qr_offline_jwt de may quet xac thuc khong can mang.")) return;
    setOfflineLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/gates/tenant-settings/enable-offline`, { method: "POST", headers: { "x-api-key": offlineRawKey.trim() } });
      if (!response.ok) throw new Error(await response.text());
      setOfflineSettings(await response.json() as OfflineSettings);
      setMessage("Da bat che do quet offline cho tenant nay.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Khong bat duoc che do offline.");
    } finally {
      setOfflineLoading(false);
    }
  }

  const liveKeys = overview.keys.filter((key) => !key.isTest);
  const testKeys = overview.keys.filter((key) => key.isTest);
  const maxDaily = Math.max(1, ...analytics.daily.map((day) => day.requests));
  const keyKeyword = keySearch.trim().toLowerCase();
  const filteredKeys = overview.keys.filter((key) => {
    const rental = overview.rentals.find((item) => item.id === key.rentalId || item.apiKeyPrefix === key.prefix);
    const haystack = [
      key.prefix,
      key.isTest ? "test" : "live",
      key.status,
      key.scopes.join(" "),
      rental?.appName,
      rental?.plan,
      rental?.status
    ].filter(Boolean).join(" ").toLowerCase();
    return !keyKeyword || haystack.includes(keyKeyword);
  });
  const keyTotalPages = Math.max(1, Math.ceil(filteredKeys.length / keyPageSize));
  const currentKeyPage = Math.min(keyPage, keyTotalPages);
  const pagedKeys = filteredKeys.slice((currentKeyPage - 1) * keyPageSize, currentKeyPage * keyPageSize);

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-zinc-500">Developer console</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">API Keys va van hanh QR</h1></div><Link href="/thue-api" className="btn btn-primary text-sm"><KeyRound size={16} /> Thue API moi</Link></div>
      {message && <p className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">{message}</p>}
      {rawKey && <section className="panel mt-5 border-emerald-200 bg-emerald-50 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-emerald-800">Raw key chi hien mot lan</p><p className="mt-1 text-xs text-emerald-700">Copy vao password manager/vault, sau khi dong se khong reveal lai duoc.</p>{rawKeyRevokeAt && <p className="mt-2 text-xs font-medium text-amber-800">Key cu van hoat dong them 7 ngay, hay cap nhat key moi vao he thong truoc khi het han. Han revoke: {new Date(rawKeyRevokeAt).toLocaleDateString("vi-VN")}.</p>}</div><div className="flex gap-2"><button className="btn btn-secondary h-9 bg-white px-3 text-xs" onClick={() => void copyOnce(rawKey, "raw API key")}><Copy size={14} /> Copy</button><button className="btn btn-secondary h-9 bg-white px-3 text-xs" onClick={() => { setRawKey(""); setRawKeyRevokeAt(null); }}><Trash2 size={14} /> An</button></div></div><pre className="mt-3 overflow-auto rounded-lg bg-white p-3 text-xs text-emerald-900">{rawKey}</pre></section>}

      <div className="mt-6 grid gap-4 md:grid-cols-4"><Stat label="Live keys" value={String(liveKeys.length)} /><Stat label="Test keys" value={String(testKeys.length)} /><Stat label="Requests thang nay" value={analytics.totals.requests.toLocaleString("vi-VN")} /><Stat label="Pay-as-you-go" value={money(analytics.totals.billed_amount)} /></div>

      {activeSection === "keys" && (
        <ApiKeyTable
          keys={pagedKeys}
          rentals={overview.rentals}
          totalKeys={overview.keys.length}
          filteredCount={filteredKeys.length}
          search={keySearch}
          page={currentKeyPage}
          pageSize={keyPageSize}
          totalPages={keyTotalPages}
          ipDrafts={ipDrafts}
          onSearch={(value) => setKeySearch(value)}
          onPageChange={(page) => setKeyPage(page)}
          onPageSizeChange={(size) => setKeyPageSize(size)}
          onRefresh={() => void load()}
          onUpdateScopes={(key, scopes) => void updateScopes(key, scopes)}
          onIpDraftChange={(keyId, next) => setIpDrafts((current) => ({ ...current, [keyId]: next }))}
          onSaveIps={(key, next) => void saveIps(key, next)}
          onRotate={(key) => void rotateKey(key)}
          onRevoke={(key) => void revokeKey(key)}
        />
      )}

      {activeSection === "secrets" && (
        <RentalTable
          rentals={overview.rentals}
          keys={overview.keys}
          secret={secret}
          offlineSettings={offlineSettings}
          offlineRawKey={offlineRawKey}
          offlineLoading={offlineLoading}
          onOfflineRawKeyChange={(value) => setOfflineRawKey(value)}
          onCheckOfflineSettings={() => void fetchOfflineSettings()}
          onEnableOffline={() => void enableTenantOffline()}
          onRevealSecrets={(rental) => void revealSecrets(rental)}
          onCreateVerifyKey={(rental) => void createVerifyKey(rental)}
          onCreateTestKey={(rental) => void createTestKey(rental)}
          onToggleSigning={(rental) => void toggleSigning(rental)}
          onRotateSecret={(rental, kind) => void rotateSecret(rental, kind)}
          onCopySecret={(value, label) => void copyOnce(value, label)}
          onClearSecrets={(rentalId) => clearSecrets(rentalId)}
        />
      )}

      {activeSection === "analytics" && <section id="analytics" className="panel mt-6 p-5"><div className="flex items-center gap-2"><BarChart3 size={18} /><h2 className="font-semibold">Usage analytics</h2></div><div className="mt-4 flex h-40 items-end gap-2 border-b border-zinc-200">{analytics.daily.slice(-31).map((day) => <div key={day.date} className="flex min-w-6 flex-1 flex-col items-center justify-end gap-2"><div className="w-full rounded-t bg-zinc-900" style={{ height: `${Math.max(6, (day.requests / maxDaily) * 130)}px` }} /><span className="text-[10px] text-zinc-500">{day.date.slice(8)}</span></div>)}{!analytics.daily.length && <p className="pb-6 text-sm text-zinc-500">Chua co request nao trong thang nay.</p>}</div></section>}

      {activeSection === "webhooks" && <section id="webhooks" className="panel mt-6 overflow-hidden"><div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-5 py-4"><Webhook size={18} /><h2 className="font-semibold">Webhook delivery logs</h2></div><div className="divide-y divide-zinc-200">{webhooks.map((item) => <article key={item.id} className="p-5 text-sm"><div className="flex flex-wrap justify-between gap-3"><b>{item.event}</b><span>{item.status} - {item.attempts} attempts - manual {item.manualReplayCount}/5</span></div><p className="mt-1 text-xs text-zinc-500">{new Date(item.createdAt).toLocaleString("vi-VN")}</p>{item.logs[0] && <p className="mt-2 text-zinc-600">Latest: HTTP {item.logs[0].statusCode ?? "-"} {item.logs[0].error ?? ""}</p>}<button className="btn btn-secondary mt-3 text-sm" disabled={item.manualReplayCount >= 5} onClick={() => void retryWebhook(item.id)}>Replay</button></article>)}{!webhooks.length && <p className="p-5 text-sm text-zinc-500">Chua co webhook nao.</p>}</div></section>}

      {activeSection === "audit" && <section id="audit" className="panel mt-6 overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 p-5"><div><h2 className="font-semibold">Audit logs</h2><p className="mt-1 text-sm text-zinc-600">{audit.total.toLocaleString("vi-VN")} request theo bo loc hien tai.</p></div><button className="btn btn-secondary text-sm" onClick={exportAudit}><Download size={16} /> CSV 10k</button></div><div className="grid gap-3 border-b border-zinc-200 p-5 md:grid-cols-6"><input className="field" placeholder="Endpoint" value={auditFilter.endpoint} onChange={e => setAuditFilter(v => ({ ...v, endpoint: e.target.value }))} /><input className="field" placeholder="Status 403/429" value={auditFilter.status} onChange={e => setAuditFilter(v => ({ ...v, status: e.target.value }))} /><input className="field" type="date" value={auditFilter.from} onChange={e => setAuditFilter(v => ({ ...v, from: e.target.value }))} /><input className="field" type="date" value={auditFilter.to} onChange={e => setAuditFilter(v => ({ ...v, to: e.target.value }))} /><select className="field" value={auditFilter.is_test} onChange={e => setAuditFilter(v => ({ ...v, is_test: e.target.value }))}><option value="">Live + test</option><option value="false">Live only</option><option value="true">Test only</option></select><div className="flex gap-2"><button className="btn btn-primary flex-1 text-sm" onClick={() => void load(auditFilter)}>Loc</button><button className="btn btn-secondary px-3 text-sm" onClick={() => { setAuditFilter(emptyAuditFilter); void load(emptyAuditFilter); }}>Reset</button></div></div><div className="overflow-auto"><table className="w-full min-w-[920px] text-left text-sm"><tbody className="divide-y divide-zinc-200">{audit.items.map(row => <tr key={row.id}><td className="px-5 py-3">{new Date(row.createdAt).toLocaleString("vi-VN")}</td><td className="px-5 py-3">{row.method}</td><td className="px-5 py-3">{row.endpoint}</td><td className="px-5 py-3">{row.statusCode}</td><td className="px-5 py-3">{row.durationMs}ms</td><td className="px-5 py-3">{row.isTest ? "test" : "live"}</td><td className="px-5 py-3">{row.ip ?? "-"}</td><td className="px-5 py-3">{row.error ?? ""}</td></tr>)}{!audit.items.length && <tr><td className="px-5 py-6 text-zinc-500">Chua co audit log.</td></tr>}</tbody></table></div></section>}
      {rotateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="rotate-key-title">
          <form className="panel w-full max-w-md p-6" onSubmit={(event) => { event.preventDefault(); void submitRotate(); }}>
            <h2 id="rotate-key-title" className="text-lg font-semibold">Cấp lại API key</h2>
            <p className="mt-2 text-sm text-zinc-600">Quên key? Cấp lại ngay, giữ nguyên scope, quota và quyền hạn hiện tại.</p>
            <p className="mt-2 text-xs text-zinc-500">Key cũ vẫn hoạt động thêm 7 ngày sau khi cấp lại.</p>
            <label className="mt-5 grid gap-2 text-sm font-medium">
              Mật khẩu hiện tại
              <input className="field" type="password" value={rotatePassword} onChange={(event) => setRotatePassword(event.target.value)} autoFocus required />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setRotateTarget(null)} disabled={rotating}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={rotating}>{rotating ? "Đang cấp lại..." : "Cấp lại key"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="panel p-5"><span className="text-sm text-zinc-500">{label}</span><b className="mt-2 block text-2xl">{value}</b></div>; }

function ApiKeyTable({
  keys,
  rentals,
  totalKeys,
  filteredCount,
  search,
  page,
  pageSize,
  totalPages,
  ipDrafts,
  onSearch,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  onUpdateScopes,
  onIpDraftChange,
  onSaveIps,
  onRotate,
  onRevoke
}: {
  keys: DeveloperKey[];
  rentals: DeveloperRental[];
  totalKeys: number;
  filteredCount: number;
  search: string;
  page: number;
  pageSize: number;
  totalPages: number;
  ipDrafts: Record<string, string[]>;
  onSearch: (value: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onRefresh: () => void;
  onUpdateScopes: (key: DeveloperKey, scopes: string[]) => void;
  onIpDraftChange: (keyId: string, next: string[]) => void;
  onSaveIps: (key: DeveloperKey, next: string[]) => void;
  onRotate: (key: DeveloperKey) => void;
  onRevoke: (key: DeveloperKey) => void;
}) {
  return (
    <section id="keys" className="panel mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-5 py-4">
        <div>
          <h2 className="font-semibold">API keys</h2>
          <p className="mt-1 text-sm text-zinc-600">Quan ly scope, rental, IP whitelist, sandbox va rotation 7 ngay.</p>
        </div>
        <button className="btn btn-secondary text-sm" onClick={onRefresh}><RefreshCw size={16} /> Refresh</button>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 p-5">
        <div className="grid w-full gap-1 sm:max-w-sm">
          <span className="text-xs font-medium text-zinc-500">Tim key</span>
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input className="h-10 w-full rounded-lg border border-zinc-300 bg-white py-2 pl-10 pr-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-900" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Rental/app, prefix, scope..." />
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-3 text-sm text-zinc-600">
          {search && <button className="btn btn-secondary h-10 px-3 text-sm" onClick={() => onSearch("")}>Xoa tim</button>}
          <span>{filteredCount.toLocaleString("vi-VN")}/{totalKeys.toLocaleString("vi-VN")} key</span>
          <select className="field h-10 w-28 text-sm" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
            <option value={5}>5/trang</option>
            <option value={10}>10/trang</option>
            <option value={20}>20/trang</option>
            <option value={50}>50/trang</option>
          </select>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full min-w-[1240px] text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-5 py-3">Prefix</th>
              <th className="px-5 py-3">Rental/App</th>
              <th className="px-5 py-3">Mode</th>
              <th className="px-5 py-3">Scopes</th>
              <th className="px-5 py-3">IP whitelist</th>
              <th className="px-5 py-3">Rate</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {keys.map((key) => {
              const rental = rentals.find((item) => item.id === key.rentalId || item.apiKeyPrefix === key.prefix);
              return (
                <tr key={key.id}>
                  <td className="px-5 py-4"><b>{key.prefix}...</b><p className="mt-1 text-xs text-zinc-500">Quota {key.quota.toLocaleString("vi-VN")}</p></td>
                  <td className="px-5 py-4"><b className="text-sm">{rental?.appName ?? "User-level key"}</b><p className="mt-1 text-xs text-zinc-500">{rental ? `${rental.plan} - ${rental.status}` : "Khong gan voi rental cu the"}</p></td>
                  <td className="px-5 py-4">{key.isTest ? "test" : "live"}</td>
                  <td className="px-5 py-4"><div className="flex flex-wrap gap-2">{fullScopes.map((scope) => { const checked = key.scopes.includes(scope); const next = checked ? key.scopes.filter((item) => item !== scope) : Array.from(new Set([...key.scopes, scope])); return <button key={scope} className={`rounded-lg border px-2.5 py-1 text-xs ${checked ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-600"}`} onClick={() => onUpdateScopes(key, next)}>{scope}</button>; })}</div></td>
                  <td className="px-5 py-4"><IpWhitelistEditor value={ipDrafts[key.id] ?? key.allowedIps} onChange={(next) => onIpDraftChange(key.id, next)} onSave={(next) => onSaveIps(key, next)} /></td>
                  <td className="px-5 py-4">{key.rateLimit}/phut</td>
                  <td className="px-5 py-4">
                    <span className={key.status === "revoked" ? "font-medium text-red-700" : key.status === "deprecated" ? "font-medium text-amber-700" : "font-medium text-emerald-700"}>
                      {key.status}
                    </span>
                    <p className="mt-1 text-xs text-zinc-600">{keyLifecycleNote(key)}</p>
                  </td>
                  <td className="px-5 py-4">{key.status === "revoked" ? <span className="text-xs text-zinc-500">Da revoke</span> : <div className="flex flex-wrap gap-2"><button className="btn btn-secondary text-sm" title="Quên key? Cấp lại ngay, giữ nguyên quyền hạn hiện tại." onClick={() => onRotate(key)}><RotateCcw size={16} /> Cấp lại key</button><button className="btn btn-secondary text-sm" onClick={() => onRevoke(key)}><Trash2 size={16} /> Revoke</button></div>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!keys.length && <p className="p-5 text-sm text-zinc-500">{totalKeys ? "Khong co key phu hop voi bo loc." : "Chua co API key."}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-5 py-4 text-sm text-zinc-600">
        <span>Trang {page}/{totalPages}</span>
        <div className="flex gap-2">
          <button className="btn btn-secondary h-9 px-3 text-sm" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))}><ChevronLeft size={16} /> Truoc</button>
          <button className="btn btn-secondary h-9 px-3 text-sm" disabled={page >= totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))}>Sau <ChevronRight size={16} /></button>
        </div>
      </div>
    </section>
  );
}

function RentalTable({
  rentals,
  keys,
  secret,
  offlineSettings,
  offlineRawKey,
  offlineLoading,
  onOfflineRawKeyChange,
  onCheckOfflineSettings,
  onEnableOffline,
  onRevealSecrets,
  onCreateVerifyKey,
  onCreateTestKey,
  onToggleSigning,
  onRotateSecret,
  onCopySecret,
  onClearSecrets
}: {
  rentals: DeveloperRental[];
  keys: DeveloperKey[];
  secret: Record<string, string | null>;
  offlineSettings: OfflineSettings | null;
  offlineRawKey: string;
  offlineLoading: boolean;
  onOfflineRawKeyChange: (value: string) => void;
  onCheckOfflineSettings: () => void;
  onEnableOffline: () => void;
  onRevealSecrets: (rental: DeveloperRental) => void;
  onCreateVerifyKey: (rental: DeveloperRental) => void;
  onCreateTestKey: (rental: DeveloperRental) => void;
  onToggleSigning: (rental: DeveloperRental) => void;
  onRotateSecret: (rental: DeveloperRental, kind: "signing" | "webhook") => void;
  onCopySecret: (value: string, label: string) => void;
  onClearSecrets: (rentalId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const keyword = search.trim().toLowerCase();
  const filteredRentals = useMemo(() => {
    return rentals.filter((rental) => {
      const rentalKeys = keys.filter((key) => key.rentalId === rental.id);
      const haystack = [
        rental.appName,
        ...rentalKeys.map((key) => key.prefix)
      ].filter(Boolean).join(" ").toLowerCase();
      return !keyword || haystack.includes(keyword);
    });
  }, [keys, keyword, rentals]);
  const totalPages = Math.max(1, Math.ceil(filteredRentals.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRentals = filteredRentals.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => setPage(1), [keyword, pageSize]);
  useEffect(() => {
    if (!keyword) return;
    const matchedKey = keys.find((key) => key.prefix.toLowerCase() === keyword && key.rentalId);
    if (!matchedKey?.rentalId) return;
    const matchedIndex = filteredRentals.findIndex((rental) => rental.id === matchedKey.rentalId);
    if (matchedIndex >= 0) setPage(Math.floor(matchedIndex / pageSize) + 1);
    setExpandedIds((current) => {
      if (current.has(matchedKey.rentalId!)) return current;
      return new Set([...current, matchedKey.rentalId!]);
    });
  }, [filteredRentals, keys, keyword, pageSize]);

  function toggleExpanded(rentalId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(rentalId)) next.delete(rentalId);
      else next.add(rentalId);
      return next;
    });
  }

  function keyCounts(rentalId: string) {
    const rentalKeys = keys.filter((key) => key.rentalId === rentalId);
    return {
      active: rentalKeys.filter((key) => key.status === "active").length,
      deprecated: rentalKeys.filter((key) => key.status === "deprecated").length,
      revoked: rentalKeys.filter((key) => key.status === "revoked").length
    };
  }

  return (
    <section id="secrets" className="panel mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-5 py-4">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck size={18} /><h2 className="font-semibold">Rental secrets</h2></div>
          <p className="mt-1 text-sm text-zinc-600">Bam icon con mat tren tung rental de nhap mat khau va hien signing/webhook secret. Secret sau khi rotate chi hien mot lan.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 p-5">
        <div className="grid w-full gap-1 sm:max-w-sm">
          <span className="text-xs font-medium text-zinc-500">Tim rental</span>
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input className="h-10 w-full rounded-lg border border-zinc-300 bg-white py-2 pl-10 pr-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-900" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rental/app, prefix, scope..." />
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-3 text-sm text-zinc-600">
          {search && <button className="btn btn-secondary h-10 px-3 text-sm" onClick={() => setSearch("")}>Xoa tim</button>}
          <span>{filteredRentals.length.toLocaleString("vi-VN")}/{rentals.length.toLocaleString("vi-VN")} rental</span>
          <select className="field h-10 w-28 text-sm" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            <option value={5}>5/trang</option>
            <option value={10}>10/trang</option>
            <option value={20}>20/trang</option>
            <option value={50}>50/trang</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 border-b border-zinc-200 p-5 lg:grid-cols-[1fr_auto]">
        <div>
          <p className="text-sm font-semibold text-zinc-900">Che do quet offline self-service</p>
          <p className="mt-1 text-xs text-zinc-500">
            Dung raw API key co scope qr:create cua tenant can bat. Sau khi bat, tenant se nhan qr_offline_jwt cho QR phat hanh moi.
          </p>
          {offlineSettings?.offline_capable && (
            <p className="mt-2 text-sm text-emerald-700">
              Da bat - ke tu {offlineSettings.enabled_at ? new Date(offlineSettings.enabled_at).toLocaleString("vi-VN") : "khong ro thoi diem"}.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="field h-10 w-full min-w-64 text-sm sm:w-80"
            type="password"
            value={offlineRawKey}
            onChange={(event) => onOfflineRawKeyChange(event.target.value)}
            placeholder="sk_live_... co scope qr:create"
          />
          <button className="btn btn-secondary h-10 px-3 text-sm" onClick={onCheckOfflineSettings} disabled={offlineLoading || !offlineRawKey.trim()}>
            Kiem tra
          </button>
          {!offlineSettings?.offline_capable && (
            <button className="btn btn-primary h-10 px-3 text-sm" onClick={onEnableOffline} disabled={offlineLoading || !offlineRawKey.trim()}>
              Bat che do quet offline cho tenant nay
            </button>
          )}
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-5 py-3">APP/RENTAL</th>
              <th className="px-5 py-3">PLAN</th>
              <th className="px-5 py-3">STATUS</th>
              <th className="px-5 py-3">SO KEY</th>
              <th className="px-5 py-3">HMAC</th>
              <th className="px-5 py-3">WEBHOOK</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {pagedRentals.map((rental) => {
              const counts = keyCounts(rental.id);
              const isExpanded = expandedIds.has(rental.id);
              return (
                <Fragment key={rental.id}>
                  <tr className="cursor-pointer" onClick={() => toggleExpanded(rental.id)}>
                    <td className="px-5 py-4"><b>{rental.appName}</b><p className="mt-1 text-xs text-zinc-500">#{rental.id.slice(0, 4)} - {rental.createdAt ? new Date(rental.createdAt).toLocaleDateString("vi-VN") : "-"}</p></td>
                    <td className="px-5 py-4">{rental.plan} - {rental.billingMode} - {rental.quota.toLocaleString("vi-VN")}</td>
                    <td className="px-5 py-4"><span className="rounded-lg bg-zinc-100 px-3 py-1 text-sm">{rental.status}</span></td>
                    <td className="px-5 py-4 text-zinc-600">{counts.active} active · {counts.deprecated} sap het han · {counts.revoked} revoked</td>
                    <td className="px-5 py-4">{rental.signingEnabled ? "Bat" : "Tat"}</td>
                    <td className="px-5 py-4"><span className="line-clamp-2 break-all text-zinc-600">{rental.callbackUrl || "Chua cau hinh"}</span></td>
                    <td className="px-5 py-4">
                      <button type="button" className="btn btn-secondary h-9 w-9 p-0" onClick={(event) => { event.stopPropagation(); toggleExpanded(rental.id); }} aria-label={isExpanded ? "Thu gon rental" : "Mo rental"}>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={7} className="bg-zinc-50 px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button className="btn btn-secondary text-sm" onClick={() => onCreateVerifyKey(rental)}><KeyRound size={16} /> Verify key</button>
                          <button className="btn btn-secondary text-sm" onClick={() => onCreateTestKey(rental)}><KeyRound size={16} /> Test key</button>
                          <button className="btn btn-secondary text-sm" onClick={() => onToggleSigning(rental)}><ShieldCheck size={16} /> {rental.signingEnabled ? "Tat HMAC" : "Bat HMAC"}</button>
                          <button className="btn btn-secondary text-sm" onClick={() => onRotateSecret(rental, "signing")}><RotateCcw size={16} /> Signing</button>
                          <button className="btn btn-secondary text-sm" onClick={() => onRotateSecret(rental, "webhook")}><RotateCcw size={16} /> Webhook</button>
                        </div>
                        <p className="mt-3 text-xs text-zinc-500">Webhook: {rental.callbackUrl || "chua cau hinh"}</p>
                        <RentalKeys rentalId={rental.id} keys={keys} onSelectKey={() => undefined} />
                        <SecretBlock label="signing" value={secret[`${rental.id}:signing`]} onCopy={(value) => onCopySecret(value, "signing secret")} />
                        <SecretBlock label="webhook" value={secret[`${rental.id}:webhook`]} onCopy={(value) => onCopySecret(value, "webhook secret")} />
                        {(secret[`${rental.id}:signing`] || secret[`${rental.id}:webhook`]) && <button className="btn btn-secondary mt-3 h-9 px-3 text-xs" onClick={() => onClearSecrets(rental.id)}><Trash2 size={14} /> An secret</button>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {!filteredRentals.length && <p className="p-5 text-sm text-zinc-500">{rentals.length ? "Khong co rental phu hop voi bo loc." : "Chua co rental nao."}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-5 py-4 text-sm text-zinc-600">
        <span>Trang {currentPage}/{totalPages}</span>
        <div className="flex gap-2">
          <button className="btn btn-secondary h-9 px-3 text-sm" disabled={currentPage <= 1} onClick={() => setPage(Math.max(1, currentPage - 1))}><ChevronLeft size={16} /> Truoc</button>
          <button className="btn btn-secondary h-9 px-3 text-sm" disabled={currentPage >= totalPages} onClick={() => setPage(Math.min(totalPages, currentPage + 1))}>Sau <ChevronRight size={16} /></button>
        </div>
      </div>
    </section>
  );
}

function keyLifecycleNote(key: DeveloperKey) {
  if (key.status === "revoked") return "Key đã revoke, không còn dùng được.";
  if (key.status === "deprecated") {
    return key.revokeAt
      ? `Key đã rotate; sẽ revoke ngày ${new Date(key.revokeAt).toLocaleDateString("vi-VN")}.`
      : "Key đã rotate và đang chờ revoke.";
  }
  return "Key chưa bị revoke hoặc rotate.";
}

function RentalKeys({ rentalId, keys, onSelectKey }: { rentalId: string; keys: DeveloperKey[]; onSelectKey: (prefix: string) => void }) {
  const [showRevoked, setShowRevoked] = useState(false);
  const rentalKeys = keys.filter((key) => key.rentalId === rentalId);
  const activeKeys = rentalKeys.filter((key) => key.status === "active");
  const deprecatedKeys = rentalKeys.filter((key) => key.status === "deprecated");
  const revokedKeys = rentalKeys.filter((key) => key.status === "revoked");
  const renderKey = (key: DeveloperKey) => (
    <button type="button" key={key.id} className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-left text-xs" onClick={() => onSelectKey(key.prefix)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b>{key.prefix}...</b>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-zinc-100 px-2 py-1">{key.isTest ? "test" : "live"}</span>
          <span className={`rounded-lg px-2 py-1 ${
            key.status === "revoked"
              ? "bg-red-50 text-red-700"
              : key.status === "deprecated"
                ? "bg-amber-50 text-amber-700"
                : "bg-emerald-50 text-emerald-700"
          }`}>
            {key.status}
          </span>
        </div>
      </div>
      <p className="mt-2 text-zinc-500">{key.scopes.join(", ")}</p>
      {key.status === "deprecated" && key.revokeAt && <p className="mt-2 text-amber-700">Revoke ngay {new Date(key.revokeAt).toLocaleDateString("vi-VN")}</p>}
      <p className={`mt-2 font-medium ${
        key.status === "revoked" ? "text-red-700" : key.status === "deprecated" ? "text-amber-700" : "text-zinc-600"
      }`}>
        {keyLifecycleNote(key)}
      </p>
    </button>
  );

  return (
    <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-xs font-semibold uppercase text-zinc-500">Keys thuoc rental</p>
      <div className="mt-2 grid gap-2">
        {activeKeys.map(renderKey)}
        {deprecatedKeys.map(renderKey)}
        {revokedKeys.length > 0 && (
          <button type="button" className="text-left text-xs font-medium text-zinc-600" onClick={() => setShowRevoked((current) => !current)}>
            {showRevoked ? "An key da revoke" : `Xem ${revokedKeys.length} key da revoke`}
          </button>
        )}
        {showRevoked && revokedKeys.map(renderKey)}
        {!rentalKeys.length && <p className="text-xs text-zinc-500">Chua co key nao gan voi rental nay.</p>}
      </div>
    </div>
  );
}

function SecretBlock({ label, value, onCopy }: { label: string; value?: string | null; onCopy: (value: string) => void }) {
  if (!value) return null;
  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-amber-900">{label} secret dang hien mot lan</p>
        <button className="btn btn-secondary h-8 bg-white px-3 text-xs" onClick={() => onCopy(value)}><Copy size={14} /> Copy</button>
      </div>
      <pre className="mt-2 overflow-auto rounded-lg bg-white p-2 text-xs text-amber-950">{value}</pre>
    </div>
  );
}


function IpWhitelistEditor({ value, onChange, onSave }: { value: string[]; onChange: (next: string[]) => void; onSave: (next: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const next = draft.split(",").map((item) => item.trim()).filter(Boolean);
    if (!next.length) return;
    onChange(Array.from(new Set([...value, ...next])));
    setDraft("");
  };
  return (
    <div className="min-w-[260px] space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((ip) => (
          <button key={ip} type="button" className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700" onClick={() => onChange(value.filter((item) => item !== ip))}>
            {ip} x
          </button>
        ))}
        {!value.length && <span className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-500">Moi IP</span>}
      </div>
      <div className="flex gap-2">
        <input className="field h-9 text-xs" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} placeholder="1.2.3.4 hoac 10.0.0.0/24" />
        <button type="button" className="btn btn-secondary h-9 px-3 text-xs" onClick={add}>Add</button>
        <button type="button" className="btn h-9 px-3 text-xs" onClick={() => onSave(value)}>Save</button>
      </div>
      <p className="text-[11px] text-zinc-500">Ho tro exact IP, CIDR va IPv4 range a-b.</p>
    </div>
  );
}
