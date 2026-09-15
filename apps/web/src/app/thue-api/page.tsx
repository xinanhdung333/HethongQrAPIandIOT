"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { Braces, CircleHelp, Copy, KeyRound, Loader2, Play, ShieldCheck, Webhook, Zap } from "lucide-react";
import { api, money } from "@/lib/api";

const plans = {
  starter: { label: "Starter", price: 199000, quota: 5000, rate: "60 req/phut" },
  business: { label: "Business", price: 499000, quota: 30000, rate: "600 req/phut" }
} as const;

const scopeOptions = [
  { value: "qr:create", label: "Tạo QR" },
  { value: "qr:read", label: "Đọc QR SVG" },
  { value: "ticket:verify", label: "Xác minh cổng" }
] as const;

export default function ApiRentalPage() {
  const [plan, setPlan] = useState<keyof typeof plans>("starter");
  const [duration, setDuration] = useState(1);
  const [selectedScopes, setSelectedScopes] = useState<string[]>(scopeOptions.map((scope) => scope.value));
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [enableOfflineRsa, setEnableOfflineRsa] = useState(false);
  const [showRsaTooltip, setShowRsaTooltip] = useState(false);
  const [testKey, setTestKey] = useState("");
  const [resourceType, setResourceType] = useState("iot_device");
  const [resourceId, setResourceId] = useState("door-001-session");
  const [explorerResult, setExplorerResult] = useState("");

  const selectedPlan = plans[plan];
  const total = selectedPlan.price * duration;

  async function submit(formData: FormData) {
    setMessage("");
    const appName = String(formData.get("app_name") ?? "").trim();
    const website = String(formData.get("website") ?? "").trim();
    const callbackUrl = String(formData.get("callback_url") ?? "").trim();
    if (!appName) return setMessage("Vui lòng nhập tên website/app.");
    if (!selectedScopes.length) return setMessage("Vui lòng chọn ít nhất một scope.");
    if (enableOfflineRsa && !confirm("Ban dang bat che do ky RSA cho tenant nay. Sau khi bat, KHONG THE TAT LAI. Tiep tuc?")) {
      return;
    }
    setSubmitting(true);
    try {
      const result = await api<{ payment_url: string }>("/api-rentals", {
        method: "POST",
        body: JSON.stringify({ app_name: appName, website, callback_url: callbackUrl, plan, duration, scopes: selectedScopes })
      });
      const paymentUrl = new URL(result.payment_url, window.location.origin);
      if (enableOfflineRsa) paymentUrl.searchParams.set("enable_offline_rsa", "1");
      window.location.href = paymentUrl.toString();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không tạo được đơn thuê API.");
    } finally {
      setSubmitting(false);
    }
  }

  async function runExplorer() {
    setExplorerResult("Đang gọi  API...");
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/v1/qr-codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": testKey, "X-API-Explorer": "true", "Idempotency-Key": `explorer-${Date.now()}` },
        body: JSON.stringify({
          resource_type: resourceType,
          resource_id: resourceId,
          ttl_seconds: 3600,
          metadata: { source: "api-explorer", use_case: "iot" },
          allowed_gate_ids: ["gate-main"]
        })
      });
      const text = await response.text();
      let result: unknown = text;
      try { result = text ? JSON.parse(text) : null; } catch {}
      setExplorerResult(JSON.stringify(result, null, 2));
    } catch (error) {
      setExplorerResult(error instanceof Error ? error.message : "Explorer failed");
    }
  }

  return (
    <main className="shell min-w-0 py-10 md:py-14">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section>
          <p className="text-sm font-medium text-zinc-500">SmartQR API v1</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">QR API cho web, server và IoT gate</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
            Tạo QR cho bất kỳ resource nào: vé sự kiện, hội viên gym, coupon, loyalty card, parking ticket, thiết bị IoT. Server của bạn giữ API key, IoT scanner gọi verify để ra quyết định allow/deny.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge icon={<Zap size={14} />} text="Bulk 500 QR/request" />
            <Badge icon={<ShieldCheck size={14} />} text="Scopes, HMAC, IP whitelist" />
            <Badge icon={<Webhook size={14} />} text="Webhook retry va signed payload" />
          </div>
          <div className="mt-5 flex w-full items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <ShieldCheck className="mt-0.5 shrink-0" size={18} />
            <p>
              Lưu ý bảo mật: API key chỉ hiển thị một lần duy nhất ngay sau khi thanh toán thành công. SmartQR không lưu key đầy đủ, kể cả admin cũng không thể xem lại. Hãy sao chép và lưu vào password manager/vault ngay khi nhận được. Nếu để mất, bạn có thể tạo key mới (rotate) trong Developer Console mà không mất scope/quyền hạn hiện tại.
            </p>
          </div>
        </section>
        <section className="panel p-5">
          <h2 className="font-semibold">Flow server IoT</h2>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-zinc-600">
            <p>1. Backend của bạn tạo QR bằng `POST /api/v1/qr-codes`.</p>
            <p>2. QR mang `resource_type`, `resource_id`, metadata va rule gate.</p>
            <p>3. IoT gateway quét mã và gọi `POST /api/v1/tickets/verify`.</p>
            <p>4. SmartQR trả `decision: allow/deny`, ghi audit log và gửi webhook.</p>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <form action={submit} className="panel grid gap-5 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100"><Braces size={18} /></div>
            <div><h2 className="font-semibold">Đăng ký thuê API</h2><p className="mt-1 text-sm text-zinc-600">Thanh toán demo xong sẽ cấp raw API key một lần.</p></div>
          </div>
          {message && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</p>}
          <label className="grid gap-2 text-sm font-medium">Tên website/app<input required name="app_name" className="field" placeholder="Gym ABC backend" /></label>
          <label className="grid gap-2 text-sm font-medium">Website<input name="website" className="field" placeholder="https://gym-abc.vn" /></label>
          <label className="grid gap-2 text-sm font-medium">Webhook callback URL<input name="callback_url" className="field" placeholder="https://gym-abc.vn/webhooks/smartqr" /></label>

          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(plans).map(([value, item]) => (
              <button key={value} type="button" className={`rounded-lg border p-4 text-left transition ${plan === value ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:bg-zinc-50"}`} onClick={() => setPlan(value as keyof typeof plans)}>
                <b>{item.label}</b>
                <p className="mt-1 text-sm text-zinc-600">{money(item.price)}/tháng</p>
                <p className="mt-2 text-xs text-zinc-500">{item.quota.toLocaleString("vi-VN")} QR/tháng - {item.rate}</p>
              </button>
            ))}
          </div>
          <label className="grid gap-2 text-sm font-medium">Thời hạn<select className="field" value={duration} onChange={(event) => setDuration(Number(event.target.value))}><option value={1}>1 tháng</option><option value={3}>3 tháng</option><option value={12}>12 tháng</option></select></label>
          <div className="grid gap-2 text-sm font-medium">
            Scopes
            <div className="flex flex-wrap gap-2">
              {scopeOptions.map((scope) => {
                const checked = selectedScopes.includes(scope.value);
                return <button key={scope.value} type="button" className={`rounded-lg border px-3 py-2 text-sm ${checked ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-600"}`} onClick={() => setSelectedScopes((current) => checked ? current.filter((item) => item !== scope.value) : [...current, scope.value])}>{scope.label}</button>;
              })}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <label className="flex items-start gap-3 text-sm font-medium text-zinc-700">
              <input
                type="checkbox"
                className="mt-1"
                checked={enableOfflineRsa}
                onChange={(event) => setEnableOfflineRsa(event.target.checked)}
              />
              <span className="flex-1">
                Bật chế độ ký RSA (public key rời khỏi hệ thống của bạn)
              </span>
              <button
                type="button"
                className="relative shrink-0 rounded-full text-zinc-400 transition hover:text-zinc-600"
                onMouseEnter={() => setShowRsaTooltip(true)}
                onMouseLeave={() => setShowRsaTooltip(false)}
                onClick={() => setShowRsaTooltip((value) => !value)}
                aria-label="Giai thich che do RSA"
              >
                <CircleHelp size={18} />
                {showRsaTooltip && (
                  <div className="absolute right-0 top-6 z-10 w-80 max-w-[calc(100vw-3rem)] rounded-lg border border-zinc-200 bg-white p-4 text-left text-xs font-normal leading-relaxed text-zinc-600 shadow-sm">
                    Mặc định, mọi vé verify online (HMAC) - server của bạn (hoặc SmartQR)
                    luôn giữ bí mật, luôn kiểm soát được. Bật mục này nếu thiết bị/app
                    thực hiện verify KHÔNG nằm trong tầm kiểm soát trực tiếp của bạn -
                    ví dụ máy quét đặt tại địa điểm thuê ngoài, app chạy trên điện thoại
                    nhân viên, hoặc bất kỳ nơi nào có thể bị truy cập vật lý ngoài ý
                    muốn. Lúc đó verify offline khi mất mạng chỉ là một lợi ích đi kèm,
                    không phải lý do chính để bật - lý do chính là: nếu thiết bị đó bị
                    lộ, nó cũng chỉ verify được (không tự tạo được vé giả), vì chỉ giữ
                    public key.
                    <br /><br />
                    <strong className="text-amber-700">Không thể tắt lại sau khi đã bật.</strong>
                  </div>
                )}
              </button>
            </label>
            {enableOfflineRsa && (
              <p className="mt-2 text-xs text-amber-700">
                Bạn đã chọn bật chế độ này - sau khi thanh toán xong sẽ không thể tắt lại.
              </p>
            )}
          </div>
          <div className="rounded-lg bg-zinc-50 p-4 text-sm"><div className="flex justify-between gap-3"><span>Thanh toan demo</span><b>{money(total)}</b></div></div>
          <button className="btn btn-primary" disabled={submitting}>{submitting ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />} Thanh toan va cap key</button>
        </form>

        <section className="panel grid gap-4 p-5">
          <div><h2 className="font-semibold">API Explorer</h2><p className="mt-1 text-sm text-zinc-600">Chi chap nhan `sk_test_...` de tranh tru quota live.</p></div>
          <label className="grid gap-2 text-sm font-medium">Test API key<input className="field" value={testKey} onChange={(event) => setTestKey(event.target.value)} placeholder="sk_test_..." /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">resource_type<input className="field" value={resourceType} onChange={(event) => setResourceType(event.target.value)} /></label>
            <label className="grid gap-2 text-sm font-medium">resource_id<input className="field" value={resourceId} onChange={(event) => setResourceId(event.target.value)} /></label>
          </div>
          <button className="btn btn-primary" onClick={() => void runExplorer()}><Play size={16} /> Gui thu</button>
          <pre className="min-h-48 overflow-auto rounded-lg border border-zinc-200 bg-zinc-950 p-4 text-xs leading-6 text-zinc-100">{explorerResult || "Response se hien o day."}</pre>
        </section>
      </div>

      <section className="panel mt-6 p-5">
        <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Node.js SDK mau</h2><button className="btn btn-secondary text-sm" onClick={() => void navigator.clipboard.writeText(nodeSample)}><Copy size={14} /> Copy</button></div>
        <pre className="mt-4 overflow-auto rounded-lg bg-zinc-950 p-4 text-xs leading-6 text-zinc-100"><code>{nodeSample}</code></pre>
        <p className="mt-4 text-sm text-zinc-600">Xem console: <Link className="font-medium text-zinc-900 underline" href="/dashboard/api-keys">/dashboard/api-keys</Link></p>
      </section>
    </main>
  );
}

function Badge({ icon, text }: { icon: ReactNode; text: string }) {
  return <span className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">{icon}{text}</span>;
}

const nodeSample = `import { SmartQrClient } from "@smartqr/sdk";

const smartqr = new SmartQrClient({
  apiKey: process.env.SMARTQR_API_KEY,
  signingSecret: process.env.SMARTQR_SIGNING_SECRET
});

const qr = await smartqr.createQrCode({
  resource_type: "iot_device",
  resource_id: "door-001-session",
  metadata: { tenant: "gym-abc", plan: "gold" },
  allowed_gate_ids: ["gate-main"],
  ttl_seconds: 3600
}, { idempotencyKey: "session-door-001" });

const decision = await smartqr.verifyTicket({
  ticket_code: qr.ticket_code,
  gate_id: "gate-main"
});`;
