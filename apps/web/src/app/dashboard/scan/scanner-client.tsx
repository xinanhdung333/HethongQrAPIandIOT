"use client";

import { useEffect, useRef, useState } from "react";
import { importSPKI, jwtVerify, type KeyLike } from "jose";
import { CheckCircle2, ImagePlus, KeyRound, ScanLine, ShieldCheck, Wifi, WifiOff, XCircle } from "lucide-react";
import { API_URL, NetworkError, api } from "@/lib/api";
import { readPrunedUsedMap } from "@/lib/offline-scan";

type OfflinePayload = { jti?: string; tenant_id?: string; type?: string; resource_type?: string; resource_id?: string };
type UsageEvent = { jti: string; gate_id: string; used_at: string; resource_type: "external_qr" | "ticket" };

const STORAGE_SHOW_USED = "show_scanner_offline_used_v1";
const STORAGE_SHOW_QUEUE = "show_scanner_offline_queue_v1";
const STORAGE_SHOW_PUBLIC_KEY = "show_scanner_public_key_v1";
const STORAGE_SHOW_TENANT_ID = "show_scanner_tenant_id_v1";

export function ScannerClient() {
  const [qr, setQr] = useState("");
  const [gate, setGate] = useState("gate-main");
  const [apiKey, setApiKey] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [camera, setCamera] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [expectedTenantId, setExpectedTenantId] = useState<string | null>(null);
  const publicKeyRef = useRef<KeyLike | null>(null);
  const validResult = Boolean(result && typeof result === "object" && "valid" in result && (result as { valid?: boolean }).valid);
  const invalidResult = Boolean(result && typeof result === "object" && "valid" in result && !(result as { valid?: boolean }).valid);

  useEffect(() => {
    const loadPublicKey = async () => {
      const cachedKey = window.localStorage.getItem(STORAGE_SHOW_PUBLIC_KEY);
      const cachedTenant = window.localStorage.getItem(STORAGE_SHOW_TENANT_ID);
      if (cachedKey && cachedTenant) {
        publicKeyRef.current = await importSPKI(cachedKey, "RS256");
        setExpectedTenantId(cachedTenant);
      }
      if (offlineMode) return;
      try {
        const data = await api<{ public_key: string; tenant_id: string }>("/api/v1/gates/session-public-key", { cache: "no-store" });
        publicKeyRef.current = await importSPKI(data.public_key, "RS256");
        setExpectedTenantId(data.tenant_id);
        window.localStorage.setItem(STORAGE_SHOW_PUBLIC_KEY, data.public_key);
        window.localStorage.setItem(STORAGE_SHOW_TENANT_ID, data.tenant_id);
      } catch {
        // Online scan still works. Offline mode will show a clear error if no key is cached.
      }
    };
    void loadPublicKey();
  }, [offlineMode]);

  useEffect(() => {
    void flushOfflineQueue();
  }, [apiKey, offlineMode]);

  async function verify() {
    setLoading(true);
    try {
      if (!offlineMode && navigator.onLine) {
        setResult(await verifyOnline());
        return;
      }
      setResult(await verifyOffline(qr.trim()));
    } catch (error) {
      if (error instanceof NetworkError && !offlineMode && navigator.onLine) {
        try {
          setResult(await verifyOffline(qr.trim()));
          return;
        } catch {
          // Keep the online error if both paths fail.
        }
      }
      setResult({ valid: false, error: error instanceof Error ? error.message : "Verify that bai" });
    } finally {
      setLoading(false);
    }
  }

  async function verifyOnlineOnly() {
    setLoading(true);
    try {
      setResult(await verifyOnline());
    } catch (error) {
      setResult({ valid: false, error: error instanceof Error ? error.message : "Verify online that bai" });
    } finally {
      setLoading(false);
    }
  }

  function verifyOnline() {
    return api("/api/v1/tickets/verify", {
      method: "POST",
      headers: apiKey ? { "x-api-key": apiKey } : { "x-demo-scan": "true" },
      body: JSON.stringify({ ticket_code: qr.trim(), gate_id: gate })
    });
  }

  async function verifyOffline(value: string) {
    const token = offlineTokenFromInput(value);
    if (!token) return { valid: false, offline: true, reason: "Ve nay khong ho tro offline" };
    if (!publicKeyRef.current || !expectedTenantId) return { valid: false, offline: true, reason: "Chua co public key offline cho tenant nay" };
    const { payload } = await jwtVerify<OfflinePayload>(token, publicKeyRef.current, { algorithms: ["RS256"] });
    if (payload.tenant_id !== expectedTenantId) return { valid: false, offline: true, reason: "Ve khong thuoc tenant cua may quet nay" };
    if (payload.type !== "ticket_offline") return { valid: false, offline: true, reason: "Token khong phai ve show (ticket_offline)" };
    if (!payload.jti) return { valid: false, offline: true, reason: "QR thieu jti" };

    const used = readPrunedUsedMap(STORAGE_SHOW_USED);
    if (used[payload.jti]) return { valid: false, offline: true, reason: `Ve da dung luc ${used[payload.jti]} tai may nay` };

    const usedAt = new Date().toISOString();
    used[payload.jti] = usedAt;
    window.localStorage.setItem(STORAGE_SHOW_USED, JSON.stringify(used));

    const queue: UsageEvent[] = JSON.parse(window.localStorage.getItem(STORAGE_SHOW_QUEUE) ?? "[]");
    queue.push({ jti: payload.jti, gate_id: gate, used_at: usedAt, resource_type: payload.type === "ticket_offline" ? "ticket" : "external_qr" });
    window.localStorage.setItem(STORAGE_SHOW_QUEUE, JSON.stringify(queue));

    return { valid: true, offline: true, gate_id: gate, resource_type: payload.resource_type, resource_id: payload.resource_id };
  }

  async function flushOfflineQueue() {
    if (!apiKey || offlineMode) return;
    const queue: UsageEvent[] = JSON.parse(window.localStorage.getItem(STORAGE_SHOW_QUEUE) ?? "[]");
    if (!queue.length) return;
    try {
      const response = await fetch(`${API_URL}/api/v1/gates/usage-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ events: queue })
      });
      if (response.ok) window.localStorage.setItem(STORAGE_SHOW_QUEUE, "[]");
    } catch {
      // Keep queue for the next online attempt.
    }
  }

  function offlineTokenFromInput(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.split(".").length === 3) return trimmed;
    try {
      const parsed = JSON.parse(trimmed) as { qr_offline_jwt?: string; qrOfflineJwt?: string; qr?: { offline_jwt?: string } };
      return parsed.qr_offline_jwt ?? parsed.qrOfflineJwt ?? parsed.qr?.offline_jwt ?? null;
    } catch {
      return null;
    }
  }

  async function startCamera() {
    const { Html5Qrcode } = await import("html5-qrcode");
    setCamera(true);
    const reader = new Html5Qrcode("qr-reader");
    await reader.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      async (decodedText) => {
        await reader.stop();
        setQr(decodedText);
        setCamera(false);
      },
      undefined
    );
  }

  async function scanFile(file?: File) {
    if (!file) return;
    setFileLoading(true);
    try {
      if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
        setResult({ decoded: false, error: "Khong doc duoc SVG. Hay tai lai QR dang PNG roi upload." });
        return;
      }
      const { Html5Qrcode } = await import("html5-qrcode");
      const reader = new Html5Qrcode("qr-reader");
      const decodedText = await reader.scanFile(file, true);
      setQr(decodedText);
      setResult({ decoded: true, source: file.name });
    } catch (error) {
      setResult({ decoded: false, error: error instanceof Error ? error.message : "Khong doc duoc ma QR tu anh" });
    } finally {
      setFileLoading(false);
    }
  }

  return (
    <main className="mx-auto min-w-0 max-w-[1200px] py-3 md:py-5">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-zinc-500">SmartQR Gate</p><h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Quét và xác minh vé</h1><p className="mt-2 text-sm text-zinc-600">Kiểm tra QR online hoặc mô phỏng thiết bị quét khi mất mạng.</p></div><button className={`btn border text-sm ${offlineMode ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`} onClick={() => setOfflineMode((value) => !value)}>{offlineMode ? <WifiOff size={16} /> : <Wifi size={16} />}{offlineMode ? "Chế độ offline" : "Đang online"}</button></div>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4"><ScanStat icon={<Wifi size={15} />} label="Kết nối" value={offlineMode ? "Offline" : "Online"} tone={offlineMode ? "amber" : "emerald"} /><ScanStat icon={<ShieldCheck size={15} />} label="Public key" value={expectedTenantId ? "Đã đồng bộ" : "Chưa đồng bộ"} tone="violet" /><ScanStat icon={<KeyRound size={15} />} label="API key" value={apiKey ? "Đã nhập" : "Demo mode"} tone="blue" /><ScanStat icon={<ScanLine size={15} />} label="Gate" value={gate || "Chưa đặt"} tone="zinc" /></div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="panel overflow-hidden"><div className="border-b border-zinc-200 bg-gradient-to-r from-blue-50/60 via-white to-violet-50/50 p-5"><h2 className="font-semibold">Nguồn dữ liệu QR</h2><p className="mt-1 text-sm text-zinc-500">Quét camera, tải ảnh hoặc dán trực tiếp token.</p></div><div className="grid gap-4 p-5 md:p-6">
          <div id="qr-reader" className="min-h-64 overflow-hidden rounded-xl border border-dashed border-blue-200 bg-blue-50/30" />
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-secondary text-sm" onClick={startCamera} disabled={camera}>
              <ScanLine size={16} />
              {camera ? "Đang mở camera" : "Mở camera"}
            </button>
            <label className="btn btn-secondary cursor-pointer text-sm">
              <ImagePlus size={16} />
              {fileLoading ? "Đang đọc ảnh" : "Tải ảnh QR"}
              <input
                className="sr-only"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={fileLoading}
                onChange={(event) => void scanFile(event.target.files?.[0])}
              />
            </label>
          </div>
          <p className="text-xs text-zinc-500">Tenant offline: {expectedTenantId ?? "chưa tải public key"}</p>
          <label className="grid gap-2 text-sm font-medium">
            QR JWT, offline JWT hoặc chuỗi code
            <textarea className="field min-h-40 font-mono text-xs" value={qr} onChange={(event) => setQr(event.target.value)} placeholder="Dán qr_jwt, qr_offline_jwt hoặc chuỗi code vé" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Gate ID
            <input className="field" value={gate} onChange={(event) => setGate(event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            API key tùy chọn
            <input className="field" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Dán key có scope ticket:verify" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary w-fit" onClick={verify} disabled={loading || !qr.trim()}>
              <ScanLine size={16} />
              {loading ? "Đang xác minh" : "Xác minh vé"}
            </button>
            <button className="btn btn-secondary w-fit text-sm" onClick={verifyOnlineOnly} disabled={loading || !qr.trim()}>
              Verify online
            </button>
          </div></div>
        </section>
        <aside className={`panel h-fit overflow-hidden lg:sticky lg:top-20 ${validResult ? "border-emerald-200" : invalidResult ? "border-red-200" : ""}`}><div className={`border-b p-5 ${validResult ? "border-emerald-200 bg-emerald-50" : invalidResult ? "border-red-200 bg-red-50" : "border-zinc-200 bg-zinc-50"}`}><div className="flex items-center gap-2">{validResult ? <CheckCircle2 size={18} className="text-emerald-700" /> : invalidResult ? <XCircle size={18} className="text-red-700" /> : <ScanLine size={18} className="text-zinc-500" />}<h2 className="font-semibold">{validResult ? "Vé hợp lệ" : invalidResult ? "Vé không hợp lệ" : "Kết quả realtime"}</h2></div><p className="mt-1 text-sm text-zinc-500">Kết quả xác minh sẽ xuất hiện tại đây.</p></div>
          <div className="p-5"><pre className="max-h-96 min-h-52 overflow-auto rounded-lg bg-zinc-950 p-4 text-xs leading-6 text-zinc-100">{result ? JSON.stringify(result, null, 2) : "Chưa có dữ liệu quét."}</pre></div>
        </aside>
      </div>
      <section className="panel mt-6 p-6">
        <h2 className="font-semibold">Gợi ý kiểm thử</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Mua vé demo trước và chờ thanh toán khoảng 5 giây. Khi có mạng, hệ thống ưu tiên xác minh online; khi mất mạng, hãy dùng `qr_offline_jwt` của vé mới.
        </p>
      </section>
    </main>
  );
}

function ScanStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "emerald" | "amber" | "violet" | "blue" | "zinc" }) { const color = tone === "emerald" ? "bg-emerald-50 text-emerald-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : tone === "violet" ? "bg-violet-50 text-violet-700" : tone === "blue" ? "bg-blue-50 text-blue-700" : "bg-zinc-100 text-zinc-600"; return <div className="panel min-w-0 p-4"><div className="flex items-center gap-2"><span className={`grid size-7 place-items-center rounded-lg ${color}`}>{icon}</span><span className="truncate text-xs uppercase text-zinc-500">{label}</span></div><b className="mt-2 block truncate text-sm">{value}</b></div>; }
