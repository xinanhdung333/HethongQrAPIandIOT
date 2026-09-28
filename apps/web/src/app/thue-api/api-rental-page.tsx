"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { Braces, Copy, KeyRound, Loader2, LockKeyhole, Play, ShieldCheck, Webhook, Zap, Fingerprint, Radio, RefreshCw } from "lucide-react";
import { api, money } from "@/lib/api";

const plans = {
  starter: { label: "Starter", price: 199000, quota: 5000, rate: "60 req/phut", mode: "Online only - Dùng HMAC" },
  business: { label: "Business", price: 499000, quota: 30000, rate: "600 req/phut", mode: "Có Offline - HMAC + RSA" }
} as const;

const hmacTooltip = "Server tự ký và tự verify bằng QR_JWT_SECRET trong ENV. Không bao giờ rời khỏi server nên an toàn, rất nhanh, QR ngắn gọn. Phù hợp cho web/app luôn có mạng.";
const rsaTooltip = "Để check-in khi mất mạng. Backend ký bằng Private Key RSA của tenant, gate chỉ giữ Public Key để verify. Dù gate bị hack cũng không tạo được vé giả. Vì phải quản lý cặp khóa, mã hóa bằng KMS và sync revoked-delta nên chi phí vận hành cao hơn.";

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
  const [testKey, setTestKey] = useState("");
  const [resourceType, setResourceType] = useState("iot_device");
  const [resourceId, setResourceId] = useState("door-001-session");
  const [explorerResult, setExplorerResult] = useState("");
  const [sdkTab, setSdkTab] = useState<keyof typeof sdkSamples>("node");

  const selectedPlan = plans[plan];
  const total = selectedPlan.price * duration;

  async function submit(formData: FormData) {
    setMessage("");
    const appName = String(formData.get("app_name") ?? "").trim();
    const website = String(formData.get("website") ?? "").trim();
    const callbackUrl = String(formData.get("callback_url") ?? "").trim();
    if (!appName) return setMessage("Vui lòng nhập tên website/app.");
    if (!selectedScopes.length) return setMessage("Vui lòng chọn ít nhất một scope.");
    if (enableOfflineRsa && !confirm("Bạn đang bật chế độ ký RSA cho tenant này. Sau khi bật, KHÔNG THỂ TẮT LẠI. Tiếp tục?")) {
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
    <main className="shell !w-[calc(100%-32px)] !max-w-[1200px] min-w-0 py-8 md:py-10">
      <div className="mb-6">
        <p className="text-sm font-medium text-zinc-500">SmartQR API v1</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Đăng ký thuê API</h1>
        <p className="mt-2 text-sm text-zinc-600">Chọn gói phù hợp với quy mô check-in của bạn.</p>
      </div>

      {/* TOP: 2 cột - Trái form thuê, Phải so sánh khóa - luôn có nội dung, không trống */}
      <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="grid gap-6">
          <form action={submit} className="panel grid gap-5 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100"><Braces size={18} /></div>
            <div><h2 className="font-semibold">Đăng ký thuê API</h2><p className="mt-1 text-sm text-zinc-600">Thanh toán demo xong sẽ cấp raw API key một lần.</p></div>
          </div>
          {message && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</p>}

          {/* GIÁ LÀM NỔI BẬT HƠN - GIỮ NGUYÊN LOGIC CHỌN GÓI */}
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Chọn gói thuê API">
            {Object.entries(plans).map(([value, item]) => {
              const isActive = plan === value;
              const isBusiness = value === "business";
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  className={`relative rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
                    isActive
                      ? isBusiness
                        ? "border-zinc-900 bg-zinc-900 text-white shadow-lg ring-1 ring-amber-300"
                        : "border-zinc-900 bg-zinc-900 text-white shadow-md"
                      : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50"
                  }`}
                  onClick={() => {
                    const nextPlan = value as keyof typeof plans;
                    setPlan(nextPlan);
                    setEnableOfflineRsa(nextPlan === "business");
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <b className={`text-[11px] uppercase tracking-widest ${isActive ? "text-zinc-300" : "text-zinc-500"}`}>{item.label}</b>
                      {isBusiness && <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${isActive ? "bg-amber-400 text-zinc-950" : "bg-amber-100 text-amber-800"}`}>Khuyên dùng cho sự kiện</span>}
                    </div>
                    <InfoTooltip placement="top" align="right" label={`${item.label}: ${value === "starter" ? hmacTooltip : rsaTooltip}`} />
                  </div>
                  {/* GIÁ TO HƠN GẤP ĐÔI */}
                  <p className="mt-3 flex items-baseline gap-1">
                    <span className="text-[32px] font-black tracking-tight leading-none">{item.price / 1000}K</span>
                    <span className={`text-sm font-medium ${isActive ? "text-zinc-300" : "text-zinc-500"}`}>/tháng</span>
                  </p>
                  <p className={`mt-2 text-[13px] font-medium leading-tight ${isActive ? "text-white" : "text-zinc-700"}`}>{item.mode}</p>
                  <p className={`mt-2 text-[11px] ${isActive ? "text-zinc-400" : "text-zinc-500"}`}>{item.quota.toLocaleString("vi-VN")} QR/tháng • {item.rate}</p>
                </button>
              )
            })}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Bao gồm trong gói</p>
            <div className="mt-2.5 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1 font-medium text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> HMAC (qrJwt)</span>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition ${plan === "business" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-zinc-200 bg-white text-zinc-400 opacity-60"}`}><span className={`h-1.5 w-1.5 rounded-full ${plan === "business" ? "bg-violet-500" : "bg-zinc-300"}`}></span> RSA Offline (+300k)</span>
            </div>
          </div>

          <label className="grid gap-2 text-sm font-medium"><span className="flex items-center gap-2">Tên tổ chức <InfoTooltip label="Tên hiển thị của website/app sử dụng API." /></span><input required name="app_name" className="field" placeholder="CÔNG TY TNHH SỰ KIỆN HANOI" /></label>
          <label className="grid gap-2 text-sm font-medium"><span className="flex items-center gap-2">Website <InfoTooltip label="Website chính của hệ thống sử dụng SmartQR." /></span><input name="website" className="field" placeholder="https://checkin.hanoievent.vn" /></label>
          <label className="grid gap-2 text-sm font-medium"><span className="flex items-center gap-2">Webhook URL <InfoTooltip label="Server sẽ POST vé về URL này để hệ thống của bạn lưu lại." /></span><input name="callback_url" className="field" placeholder="https://api.hanoievent.vn/webhooks/smartqr" /></label>
          <label className="grid gap-2 text-sm font-medium">Thời hạn<select className="field" value={duration} onChange={(event) => setDuration(Number(event.target.value))}><option value={1}>1 tháng</option><option value={3}>3 tháng</option><option value={12}>12 tháng</option></select></label>
          <div className="grid gap-2 text-sm font-medium">
            Scopes
            <div className="flex flex-wrap gap-2">
              {scopeOptions.map((scope) => {
                const checked = selectedScopes.includes(scope.value);
                return <button key={scope.value} type="button" className={`rounded-lg border px-3 py-2 text-sm transition ${checked ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"}`} onClick={() => setSelectedScopes((current) => checked ? current.filter((item) => item !== scope.value) : [...current, scope.value])}>{scope.label}</button>;
              })}
            </div>
          </div>

          {plan === "business" && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 shrink-0" size={18} />
              <div>
                <b>Cấu hình Gate Offline</b>
                <p className="mt-1 leading-6">Sau khi thanh toán, gate Business có thể đồng bộ public key và danh sách revoke:</p>
                <code className="mt-2 block rounded bg-white/70 px-2 py-1 text-xs">GET /api/v1/gates/public-key</code>
                <code className="mt-1 block rounded bg-white/70 px-2 py-1 text-xs">GET /api/v1/gates/revoked-delta</code>
                <p className="mt-2 text-xs opacity-80">Gate chỉ giữ public key; hãy sync revoked-delta trước khi mở cổng.</p>
              </div>
            </div>
          </div>}

          {plan === "business" && <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
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
              <InfoTooltip align="right" label={rsaTooltip} />
            </label>
            {enableOfflineRsa && (
              <p className="mt-2 text-xs font-medium text-amber-700">
                ⚠️ Bạn đã chọn bật chế độ này - sau khi thanh toán xong sẽ không thể tắt lại.
              </p>
            )}
          </div>}

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm"><div className="flex justify-between gap-3"><span className="text-zinc-500">Thanh toán demo</span><b className="text-[15px]">{money(total)}</b></div></div>
          <button className="btn btn-primary h-11 text-[14px] font-semibold" disabled={submitting}>{submitting ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />} Thanh toán và cấp key</button>
          </form>

          {plan === "business" && <OfflineGateIntro />}

          <section className="panel p-5">
            <h2 className="font-semibold">Response JSON mẫu sau khi cấp mã</h2>
            <p className="mt-1 text-sm text-zinc-600">Business có thêm mã dành cho gate offline.</p>
            <pre className="mt-4 overflow-auto rounded-lg bg-zinc-950 p-4 text-xs leading-6 text-zinc-100">{JSON.stringify(plan === "business"
              ? { qrJwt: "eyJ... (HMAC - HS256)", qrOfflineJwt: "eyJ... (RSA - RS256, +300k/tháng)" }
              : { qrJwt: "eyJ... (HMAC - HS256 - Đã bao gồm)" }, null, 2)}</pre>
          </section>

          <section className="panel p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h2 className="font-semibold">Checklist tích hợp</h2>
                <p className="mt-1 text-sm text-zinc-600">Kiểm tra nhanh trước khi đưa API vào hệ thống thật.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              {[
                ["01", "Lưu key ở backend", "Không đặt API key trong frontend hoặc mã QR."],
                ["02", "Dùng Idempotency-Key", "Giúp retry an toàn, không tạo trùng QR."],
                ["03", "Cấu hình webhook", "Nhận trạng thái verify và revoke theo thời gian thực."]
              ].map(([number, title, description]) => (
                <div key={number} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-semibold text-emerald-700">{number}</span>
                  <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-zinc-500">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>

        {/* CỘT PHẢI: Luôn có nội dung, không để trống */}
        <section className="grid h-full content-start gap-4">
          <div className="h-full">
            <KeyspaceIntro activePlan={plan} />
          </div>
          <div className="panel grid gap-4 p-5">
            <div className="flex items-center justify-between">
              <div><h2 className="font-semibold">API Explorer</h2><p className="mt-1 text-sm text-zinc-600">Chỉ chấp nhận `sk_test_...` để tránh trừ quota live.</p></div>
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-600">Test</span>
            </div>
            <label className="grid gap-2 text-sm font-medium"><span className="flex items-center gap-2">Test API key <InfoTooltip label="Dùng để xác thực ai được phép gọi API verify." /></span><input className="field" value={testKey} onChange={(event) => setTestKey(event.target.value)} placeholder="sk_test_..." /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">resource_type<input className="field" value={resourceType} onChange={(event) => setResourceType(event.target.value)} /></label>
              <label className="grid gap-2 text-sm font-medium">resource_id<input className="field" value={resourceId} onChange={(event) => setResourceId(event.target.value)} /></label>
            </div>
            <button className="btn btn-primary" onClick={() => void runExplorer()}><Play size={16} /> Gửi thử</button>
            <pre className="min-h-[180px] overflow-auto rounded-lg border border-zinc-200 bg-zinc-950 p-4 text-xs leading-6 text-zinc-100">{explorerResult || "Response sẽ hiện ở đây."}</pre>
          </div>
          <QuickStartCard />
        </section>
      </div>

      <div className="mt-6">
        <SdkGuide activeTab={sdkTab} onTabChange={setSdkTab} />
      </div>
    </main>
  );
}

function InfoTooltip({
  label,
  align = "left",
  placement = "bottom"
}: {
  label: string;
  align?: "left" | "right";
  placement?: "top" | "bottom";
}) {
  return (
    <span className="group relative inline-flex shrink-0">
      <span
        tabIndex={0}
        role="img"
        className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[11px] font-bold leading-none text-white transition hover:bg-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        aria-label="Giải thích"
      >
        !
      </span>
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 hidden w-80 max-w-[min(20rem,calc(100vw-2rem))] whitespace-normal rounded-lg border border-zinc-200 bg-white p-3 text-left text-xs font-normal leading-relaxed text-zinc-600 shadow-lg group-hover:block group-focus-within:block ${placement === "top" ? "bottom-7" : "top-7"} ${align === "right" ? "right-0" : "left-0"}`}
      >
        {label}
      </span>
    </span>
  );
}

function KeyCompareTable({ activePlan }: { activePlan?: string }) {
  return (
    <div className="overflow-visible rounded-lg border border-zinc-200">
      <table className="w-full text-left text-xs">
        <thead className="bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
          <tr><th className="p-3 font-medium">Khóa</th><th className="p-3 font-medium">Chế độ</th><th className="p-3 font-medium">Chi phí</th><th className="p-3 font-medium">Tốc độ</th><th className="p-3 font-medium">QR</th></tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          <tr className="bg-emerald-50/40">
            <td className="p-3"><div className="flex items-center gap-2 font-semibold text-zinc-900"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><LockKeyhole size={13} /></span> HMAC <InfoTooltip label={hmacTooltip} /></div><span className="ml-8 text-[11px] text-zinc-500">qrJwt</span></td>
            <td className="p-3"><span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px]">Online</span></td><td className="p-3"><span className="font-semibold text-emerald-700">Đã bao gồm</span></td><td className="p-3 font-mono">0.05ms</td><td className="p-3">QR nhỏ</td>
          </tr>
          <tr className={`${activePlan === "business" ? "bg-violet-50" : "bg-zinc-50/50 opacity-80"}`}>
            <td className="p-3"><div className="flex items-center gap-2 font-semibold text-zinc-900"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-violet-700"><KeyRound size={13} /></span> RSA Offline <InfoTooltip label={rsaTooltip} /></div><span className="ml-8 text-[11px] text-zinc-500">qrOfflineJwt</span></td>
            <td className="p-3"><span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">Offline</span></td>
            <td className="p-3"><span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-800">+300k/tháng</span></td>
            <td className="p-3 font-mono">3-5ms</td><td className="p-3">QR to hơn</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function KeyspaceIntro({ activePlan }: { activePlan: keyof typeof plans }) {
  return (
    <section className="panel p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white">
          <Fingerprint size={19} />
        </div>
        <div>
          <h2 className="font-semibold tracking-tight">API Keyspace + So sánh 2 khóa</h2>
          <p className="mt-1 text-sm text-zinc-600">Hiểu chi phí và đánh đổi trước khi bật RSA offline.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <KeyspaceCard
          tone="hmac"
          active={true}
          icon={<LockKeyhole size={16} />}
          title="HMAC"
          keyName="qrJwt"
          badge="Đã bao gồm"
          description="Đối xứng • HS256"
          points={["Mặc định, luôn bật", "Online verification", "0.05ms / verify, QR ngắn", "Nhỏ gọn, in được trên vé giấy"]}
        />
        <KeyspaceCard
          tone="rsa"
          active={activePlan === "business"}
          icon={<KeyRound size={16} />}
          title="RSA Offline"
          keyName="qrOfflineJwt"
          badge="+300k/tháng"
          description="Bất đối xứng • RS256"
          points={["Pro, dành cho sự kiện", "Offline, không cần internet", "3-5ms / verify, QR to hơn", "Cần sync public-key định kỳ"]}
        />
      </div>
      <div className="mt-4">
        <KeyCompareTable activePlan={activePlan} />
      </div>
    </section>
  );
}

function QuickStartCard() {
  return (
    <section className="panel p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
          <Zap size={16} />
        </div>
        <div>
          <h2 className="font-semibold">Sau khi tạo thuê bao</h2>
          <p className="mt-1 text-xs text-zinc-500">3 bước để bắt đầu check-in</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        {[
          ["01", "Lưu API key", "Raw key chỉ hiển thị một lần sau khi thanh toán."],
          ["02", "Tạo QR", "Gọi POST /api/v1/qr-codes từ backend của bạn."],
          ["03", "Verify tại gate", "Online dùng HMAC; Business có thể offline bằng RSA."]
        ].map(([number, title, description]) => (
          <div key={number} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white">{number}</span>
            <div>
              <p className="text-sm font-medium">{title}</p>
              <p className="mt-0.5 text-xs leading-5 text-zinc-500">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
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

const sdkSamples = {
  node: {
    label: "Node.js",
    package: "npm install @smartqr/sdk",
    code: nodeSample
  },
  python: {
    label: "Python",
    package: "pip install requests",
    code: `import os
from smartqr_client import SmartQrClient

client = SmartQrClient(
    os.environ["SMARTQR_API_KEY"],
    "http://localhost:4000"
)

qr = client.create_qr(
    "iot_device",
    "door-001-session",
    ttl_seconds=3600
)
print(qr["ticket_code"])`
  },
  php: {
    label: "PHP",
    package: "require './packages/sdk-php/SmartQrClient.php';",
    code: `<?php
require './SmartQrClient.php';

$client = new SmartQrClient(
    getenv('SMARTQR_API_KEY'),
    'http://localhost:4000'
);

$qr = $client->createQrCode([
    'resource_type' => 'iot_device',
    'resource_id' => 'door-001-session',
    'ttl_seconds' => 3600,
]);
echo $qr['ticket_code'];`
  },
  curl: {
    label: "cURL",
    package: "Không cần cài package",
    code: `curl -X POST http://localhost:4000/api/v1/qr-codes \\
  -H "Content-Type: application/json" \\
  -H "X-API-KEY: $SMARTQR_API_KEY" \\
  -H "Idempotency-Key: door-001-session" \\
  -d '{
    "resource_type": "iot_device",
    "resource_id": "door-001-session",
    "ttl_seconds": 3600
  }'`
  },
  fetch: {
    label: "JavaScript Fetch",
    package: "Web API tích hợp sẵn",
    code: `const response = await fetch(
  "http://localhost:4000/api/v1/qr-codes",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": process.env.SMARTQR_API_KEY,
      "Idempotency-Key": "door-001-session"
    },
    body: JSON.stringify({
      resource_type: "iot_device",
      resource_id: "door-001-session",
      ttl_seconds: 3600
    })
  }
);
const qr = await response.json();`
  }
} as const;

function SdkGuide({
  activeTab,
  onTabChange
}: {
  activeTab: keyof typeof sdkSamples;
  onTabChange: (tab: keyof typeof sdkSamples) => void;
}) {
  const sample = sdkSamples[activeTab];

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">SDK & ví dụ tích hợp</h2>
          <p className="mt-1 text-sm text-zinc-600">Chọn ngôn ngữ phù hợp với backend hoặc hệ thống IoT của bạn.</p>
        </div>
        <Link className="text-sm font-medium text-zinc-900 underline" href="/dashboard/api-keys">Quản lý API key</Link>
      </div>
      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="SDK SmartQR">
        {(Object.keys(sdkSamples) as Array<keyof typeof sdkSamples>).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${activeTab === tab ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"}`}
            onClick={() => onTabChange(tab)}
          >
            {sdkSamples[tab].label}
          </button>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
        <code className="overflow-x-auto text-xs text-zinc-700">{sample.package}</code>
        <button className="btn btn-secondary shrink-0 text-xs" onClick={() => void navigator.clipboard.writeText(sample.code)}>
          <Copy size={13} /> Copy
        </button>
      </div>
      <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-zinc-950 p-4 text-xs leading-6 text-zinc-100"><code>{sample.code}</code></pre>
    </section>
  );
}

function KeyspaceCard({
  tone,
  active,
  icon,
  title,
  keyName,
  badge,
  description,
  points
}: {
  tone: "hmac" | "rsa";
  active: boolean;
  icon: ReactNode;
  title: string;
  keyName: string;
  badge: string;
  description: string;
  points: string[];
}) {
  const rsa = tone === "rsa";
  return (
    <div className={`rounded-xl border p-4 transition-all ${!active ? "opacity-60" : ""} ${rsa ? active ? "border-violet-300 bg-violet-50/50 shadow-sm" : "border-zinc-200 bg-zinc-50" : "border-emerald-200 bg-white"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className={`flex items-center gap-2 font-semibold ${rsa ? "text-zinc-900" : "text-zinc-900"}`}>
          <span className={`flex h-7 w-7 items-center justify-center rounded-full ${rsa ? "bg-violet-100 text-violet-700" : "bg-emerald-100 text-emerald-700"}`}>{icon}</span>
          <span>{title}</span>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${rsa ? active ? "bg-amber-400 text-zinc-900" : "bg-zinc-200 text-zinc-500" : "bg-emerald-100 text-emerald-700"}`}>{badge}</span>
      </div>
      <code className="mt-3 block text-[11px] font-medium text-zinc-900">{keyName}</code>
      <p className="mt-1 text-[11px] text-zinc-500">{description}</p>
      <ul className="mt-3 grid gap-1.5 text-[11px] leading-5 text-zinc-600">
        {points.map((point) => <li key={point} className="flex gap-2"><span className="text-zinc-300">•</span><span className={point.includes("+300k") || point.includes("3-5ms") ? "font-medium" : ""}>{point}</span></li>)}
      </ul>
    </div>
  );
}

function OfflineGateIntro() {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-zinc-100 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-emerald-300">
            <Radio size={18} />
          </div>
          <div>
            <h2 className="font-semibold">Cấu hình Gate Offline</h2>
            <p className="mt-1 text-sm text-zinc-400">Chỉ hiển thị khi chọn Business.</p>
          </div>
        </div>
        <span className="rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-zinc-900">Business</span>
      </div>
      <div className="mt-4 grid gap-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-300"><ShieldCheck size={14} /> GET /api/v1/gates/public-key</div>
          <p className="mt-2 text-xs leading-5 text-zinc-400">Gate nhận public key để verify qrOfflineJwt mà không bao giờ có private key.</p>
          <code className="mt-2 block overflow-x-auto rounded bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-300">{"{ \"algorithm\": \"RS256\", \"keyId\": \"tenant-key-01\" }"}</code>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-300"><RefreshCw size={14} /> GET /api/v1/gates/revoked-delta</div>
          <p className="mt-2 text-xs leading-5 text-zinc-400">Đồng bộ ticket/QR đã revoke trước khi mở cổng.</p>
          <code className="mt-2 block overflow-x-auto rounded bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-300">{"{ \"items\": [], \"nextCursor\": \"...\" }"}</code>
        </div>
      </div>
    </section>
  );
}
