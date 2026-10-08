"use client";

import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ImagePlus,
  KeyRound,
  Play,
  ScanLine,
  ShieldCheck,
  Ticket,
  XCircle
} from "lucide-react";
import { API_URL } from "@/lib/api";

type TestQr = {
  id: string;
  qr_jwt: string;
  ticket_code: string;
  qr_offline_jwt?: string;
  is_test: boolean;
  expires_at: string;
  resource: { type: string; id: string; customer_ref?: string | null };
};

type ApiResult = Record<string, unknown> & { valid?: boolean; error?: string; message?: string };

const TEST_KEY_REQUIRED_MESSAGE = "Sandbox chỉ chấp nhận test key. Đổi môi trường sang Live để dùng API key production.";
const SIGNATURE_REQUIRED_MESSAGE = "Gói thuê đang bật HMAC. Hãy nhập đúng signing secret của gói thuê rồi thử lại.";

async function signApiRequest(secret: string, timestamp: string, method: string, path: string, body: string) {
  if (!globalThis.crypto?.subtle) throw new Error("Trình duyệt hiện tại không hỗ trợ ký HMAC. Hãy dùng HTTPS hoặc localhost.");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}${method.toUpperCase()}${path}${body}`)
  );
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readResponse(response: Response) {
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    if (body && typeof body === "object" && "error" in body && body.error === "test_key_required") {
      throw new Error(TEST_KEY_REQUIRED_MESSAGE);
    }
    if (body && typeof body === "object" && "error" in body && ["invalid_signature", "invalid_timestamp", "signing_unavailable"].includes(String(body.error))) {
      throw new Error(SIGNATURE_REQUIRED_MESSAGE);
    }
    const message = body && typeof body === "object" && "message" in body
      ? String((body as { message: unknown }).message)
      : body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `API trả về HTTP ${response.status}`;
    throw new Error(message);
  }
  return body;
}

export function ApiTestWorkbench() {
  const [createApiKey, setCreateApiKey] = useState("");
  const [createSigningSecret, setCreateSigningSecret] = useState("");
  const [scanApiKey, setScanApiKey] = useState("");
  const [scanSigningSecret, setScanSigningSecret] = useState("");
  const [mode, setMode] = useState<"create" | "scan">("create");
  const [createEnvironment, setCreateEnvironment] = useState<"test" | "live">("test");
  const [environment, setEnvironment] = useState<"test" | "live">("test");
  const [resourceType, setResourceType] = useState("demo_member");
  const [resourceId, setResourceId] = useState("member_001");
  const [customerRef, setCustomerRef] = useState("");
  const [qrInput, setQrInput] = useState("");
  const [gateId, setGateId] = useState("gate-demo-01");
  const [createdQr, setCreatedQr] = useState<TestQr | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [liveAcknowledged, setLiveAcknowledged] = useState(false);
  const [createLiveAcknowledged, setCreateLiveAcknowledged] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [fileBusy, setFileBusy] = useState(false);
  const readerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => () => {
    const reader = readerRef.current;
    if (reader) void reader.stop().then(() => reader.clear()).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (mode === "scan" || !readerRef.current) return;
    const reader = readerRef.current;
    readerRef.current = null;
    void reader.stop()
      .then(() => reader.clear())
      .then(() => setCameraActive(false))
      .catch((reason: unknown) => {
        setCameraActive(false);
        setCameraError(reason instanceof Error ? reason.message : "Không dừng được camera.");
      });
  }, [mode]);

  async function createQr(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    setCreatedQr(null);
    try {
      if (!createApiKey.trim()) throw new Error("Dán API key có scope qr:create.");
      if (createEnvironment === "live" && !createLiveAcknowledged) {
        throw new Error("Xác nhận cảnh báo tạo QR live trước khi tiếp tục.");
      }
      const requestBody = JSON.stringify({
        resource_type: resourceType.trim(),
        resource_id: resourceId.trim(),
        ...(customerRef.trim() ? { customer_ref: customerRef.trim() } : {}),
        ttl_seconds: 3600
      });
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-API-KEY": createApiKey.trim(),
        ...(createEnvironment === "test" ? { "X-API-Explorer": "true" } : {})
      };
      if (createSigningSecret.trim()) {
        const timestamp = String(Math.floor(Date.now() / 1000));
        headers["X-TIMESTAMP"] = timestamp;
        headers["X-SIGNATURE"] = await signApiRequest(
          createSigningSecret.trim(),
          timestamp,
          "POST",
          "/api/v1/qr-codes",
          requestBody
        );
      }
      const response = await fetch(`${API_URL}/api/v1/qr-codes`, {
        method: "POST",
        headers,
        body: requestBody,
        signal: AbortSignal.timeout(15000)
      });
      const body = await readResponse(response) as TestQr;
      setCreatedQr(body);
      setQrInput(body.qr_jwt);
      setResult({ success: true, message: body.is_test ? "Đã tạo QR sandbox. Có thể dùng ngay ở mục xác minh vé." : "Đã tạo QR LIVE bằng API key thật. QR có thể được dùng trong hệ thống production." });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tạo được QR.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      if (!scanApiKey.trim()) throw new Error("Dán API key có scope ticket:verify.");
      if (environment === "live" && !liveAcknowledged) {
        throw new Error("Xác nhận cảnh báo check-in vé thật trước khi tiếp tục.");
      }
      const value = extractQrValue(qrInput);
      if (!value) throw new Error("Quét hoặc dán QR JWT / ticket code trước.");
      const body = value.includes(".")
        ? { qr_jwt: value, gate_id: gateId.trim() }
        : { ticket_code: value, gate_id: gateId.trim() };
      const requestBody = JSON.stringify(body);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-API-KEY": scanApiKey.trim(),
        ...(environment === "test" ? { "X-API-Explorer": "true" } : {})
      };
      if (scanSigningSecret.trim()) {
        const timestamp = String(Math.floor(Date.now() / 1000));
        headers["X-TIMESTAMP"] = timestamp;
        headers["X-SIGNATURE"] = await signApiRequest(
          scanSigningSecret.trim(),
          timestamp,
          "POST",
          "/api/v1/tickets/verify",
          requestBody
        );
      }
      const response = await fetch(`${API_URL}/api/v1/tickets/verify`, {
        method: "POST",
        headers,
        body: requestBody,
        signal: AbortSignal.timeout(15000)
      });
      setResult(await readResponse(response) as ApiResult);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không xác minh được vé.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadCreatedQr() {
    const svg = document.getElementById("test-created-qr");
    if (!svg) {
      setError("Không tìm thấy ảnh QR để tải. Hãy tạo lại mã rồi thử tải xuống.");
      return;
    }

    let svgUrl: string | undefined;
    let pngUrl: string | undefined;
    try {
      const serialized = new XMLSerializer().serializeToString(svg);
      svgUrl = URL.createObjectURL(new Blob([serialized], { type: "image/svg+xml;charset=utf-8" }));
      const image = new Image();
      image.src = svgUrl;
      await image.decode();

      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 1024;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Trình duyệt không hỗ trợ tạo ảnh PNG.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const png = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Không thể tạo ảnh PNG."));
        }, "image/png");
      });
      pngUrl = URL.createObjectURL(png);
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = `smartqr-${createdQr?.is_test ? "test" : "live"}-${createdQr?.ticket_code ?? "qr"}.png`;
      link.click();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tải được ảnh QR.");
    } finally {
      if (svgUrl) URL.revokeObjectURL(svgUrl);
      const downloadUrl = pngUrl;
      if (downloadUrl) window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    }
  }

  async function startCamera() {
    setCameraError("");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const reader = new Html5Qrcode("public-test-qr-reader");
      readerRef.current = reader;
      setCameraActive(true);
      await reader.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const size = Math.floor(Math.min(280, viewfinderWidth * 0.85, viewfinderHeight * 0.85));
            return { width: size, height: size };
          }
        },
        async (decodedText: string) => {
          await stopCamera();
          setQrInput(decodedText);
        },
        () => undefined
      );
    } catch (reason) {
      setCameraActive(false);
      setCameraError(reason instanceof Error ? reason.message : "Không mở được camera.");
    }
  }

  async function stopCamera() {
    const reader = readerRef.current;
    readerRef.current = null;
    setCameraActive(false);
    if (reader) {
      await reader.stop();
      await reader.clear();
    }
  }

  async function scanImage(file?: File) {
    if (!file) return;
    setFileBusy(true);
    setCameraError("");
    try {
      if (readerRef.current) await stopCamera();
      const { Html5Qrcode } = await import("html5-qrcode");
      const reader = new Html5Qrcode("public-test-qr-reader");
      const decoded = await reader.scanFile(file, true);
      setQrInput(decoded);
      await reader.clear();
    } catch (reason) {
      setCameraError(reason instanceof Error ? reason.message : "Không đọc được mã QR trong ảnh.");
    } finally {
      setFileBusy(false);
    }
  }

  const valid = result?.valid === true;
  const rejected = result?.valid === false || Boolean(error);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="max-w-3xl">
        <p className="text-sm font-medium text-zinc-500">SMARTQR · API PLAYGROUND</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 md:text-4xl">Test API thuê &amp; quét vé</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-600 md:text-base">
          Tạo QR sandbox hoặc production bằng API key của gói thuê và xác minh QR tại cổng. Dùng live có thể tiêu quota hoặc phát sinh phí; key và signing secret chỉ được giữ trong bộ nhớ trình duyệt hiện tại.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Chọn công cụ kiểm thử">
        <button className={`btn text-sm ${mode === "create" ? "btn-primary" : "btn-secondary bg-white"}`} role="tab" aria-selected={mode === "create"} onClick={() => { setMode("create"); setError(""); }}>
          <Play size={16} /> Tạo QR API
        </button>
        <button className={`btn text-sm ${mode === "scan" ? "btn-primary" : "btn-secondary bg-white"}`} role="tab" aria-selected={mode === "scan"} onClick={() => { setMode("scan"); setError(""); }}>
          <Ticket size={16} /> Xác minh vé
        </button>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="panel overflow-hidden">
          {mode === "create" ? (
            <>
              <div className="border-b border-zinc-200 bg-zinc-50 p-5">
                <h2 className="font-semibold">1. Tạo QR bằng API thuê</h2>
                <p className="mt-1 text-sm leading-5 text-zinc-600">Gọi POST /api/v1/qr-codes bằng key có scope qr:create. Chọn sandbox để thử hoặc live để tạo QR production; thời hạn 1 giờ.</p>
              </div>
              <form className="grid gap-4 p-5" onSubmit={(event) => void createQr(event)}>
                <label className="grid gap-2 text-sm font-medium">
                  <span className="flex items-center gap-2"><KeyRound size={16} />Dán API key tạo QR</span>
                  <input className="field font-mono" type="password" autoComplete="off" spellCheck={false} value={createApiKey} onChange={(event) => setCreateApiKey(event.target.value)} placeholder="Key có scope qr:create" required />
                  <span className="text-xs font-normal leading-5 text-zinc-500">Tạo/reveal key tại <Link className="font-medium text-zinc-900 underline underline-offset-2" href="/dashboard/api-keys">Quản lý API key</Link>. Dùng key đúng môi trường đã chọn; live có thể tiêu quota/tính phí.</span>
                </label>
                <label className="grid gap-2 text-sm font-medium">Môi trường tạo QR
                  <select className="field bg-white" value={createEnvironment} onChange={(event) => { setCreateEnvironment(event.target.value as "test" | "live"); setCreateLiveAcknowledged(false); }}>
                    <option value="test">Test / sandbox</option>
                    <option value="live">Live / production</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Signing secret (nếu bật HMAC)
                  <input className="field font-mono" type="password" autoComplete="off" spellCheck={false} value={createSigningSecret} onChange={(event) => setCreateSigningSecret(event.target.value)} placeholder="sigsec_..." />
                  <span className="text-xs font-normal leading-5 text-zinc-500">Ký HMAC được tạo ngay trong trình duyệt; secret không gửi riêng tới server.</span>
                </label>
                <label className="grid gap-2 text-sm font-medium">Loại tài nguyên<input className="field" required maxLength={100} value={resourceType} onChange={(event) => setResourceType(event.target.value)} /></label>
                <label className="grid gap-2 text-sm font-medium">Mã tài nguyên<input className="field" required maxLength={255} value={resourceId} onChange={(event) => setResourceId(event.target.value)} /></label>
                <label className="grid gap-2 text-sm font-medium">Tham chiếu khách (không bắt buộc)<input className="field" maxLength={255} value={customerRef} onChange={(event) => setCustomerRef(event.target.value)} placeholder="Ví dụ: KH-001" /></label>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm leading-5 text-blue-900">
                  <ShieldCheck size={16} className="mr-2 inline" /> Sandbox yêu cầu test key. Live dùng key production và có thể tạo QR thật, tiêu quota hoặc phát sinh phí.
                </div>
                {createEnvironment === "live" && (
                  <label className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm leading-5 text-amber-950">
                    <input className="mt-1" type="checkbox" checked={createLiveAcknowledged} onChange={(event) => setCreateLiveAcknowledged(event.target.checked)} />
                    <span><b className="flex items-center gap-1"><AlertTriangle size={15} /> Xác nhận tạo QR live</b>Request sẽ dùng API key production. Có thể tiêu quota/tính phí và mã QR tạo ra là mã thật.</span>
                  </label>
                )}
                <button className="btn btn-primary w-fit" disabled={busy || !createApiKey.trim() || (createEnvironment === "live" && !createLiveAcknowledged)}><Play size={16} />{busy ? "Đang gọi API..." : createEnvironment === "live" ? "Tạo QR live" : "Tạo QR test"}</button>
              </form>
            </>
          ) : (
            <>
              <div className="border-b border-zinc-200 bg-zinc-50 p-5">
                <h2 className="font-semibold">2. Quét và xác minh QR</h2>
                <p className="mt-1 text-sm leading-5 text-zinc-600">Gọi POST /api/v1/tickets/verify bằng key có scope ticket:verify.</p>
              </div>
              <form className="grid gap-4 p-5" onSubmit={(event) => void verifyTicket(event)}>
                <label className="grid gap-2 text-sm font-medium">
                  <span className="flex items-center gap-2"><KeyRound size={16} />Dán API key quét vé</span>
                  <input className="field font-mono" type="password" autoComplete="off" spellCheck={false} value={scanApiKey} onChange={(event) => setScanApiKey(event.target.value)} placeholder="Key có scope ticket:verify" required />
                  <span className="text-xs font-normal leading-5 text-zinc-500">Test key để xác minh QR sandbox; show scan key để quét vé của show tương ứng.</span>
                </label>
                <label className="grid gap-2 text-sm font-medium">Môi trường
                  <select className="field bg-white" value={environment} onChange={(event) => { setEnvironment(event.target.value as "test" | "live"); setLiveAcknowledged(false); }}>
                    <option value="test">Test / sandbox</option>
                    <option value="live">Live / vé thật</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Signing secret (nếu bật HMAC)
                  <input className="field font-mono" type="password" autoComplete="off" spellCheck={false} value={scanSigningSecret} onChange={(event) => setScanSigningSecret(event.target.value)} placeholder="sigsec_..." />
                  <span className="text-xs font-normal leading-5 text-zinc-500">Nếu gói thuê bật HMAC, nhập signing secret để ký request ngay trong trình duyệt.</span>
                </label>
                <div id="public-test-qr-reader" className="min-h-16 overflow-hidden rounded-lg border border-dashed border-zinc-300 bg-zinc-50" />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-secondary text-sm" onClick={() => void (cameraActive ? stopCamera() : startCamera())} disabled={fileBusy}>
                    <ScanLine size={16} />{cameraActive ? "Tắt camera" : "Mở camera"}
                  </button>
                  <label className="btn btn-secondary cursor-pointer text-sm">
                    <ImagePlus size={16} />{fileBusy ? "Đang đọc ảnh..." : "Đọc ảnh QR"}
                    <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={fileBusy} onChange={(event) => { void scanImage(event.target.files?.[0]); event.currentTarget.value = ""; }} />
                  </label>
                </div>
                {cameraError && <p className="text-sm text-red-700">{cameraError}</p>}
                <label className="grid gap-2 text-sm font-medium">QR JWT hoặc mã vé
                  <textarea className="field min-h-28 font-mono text-xs" required value={qrInput} onChange={(event) => setQrInput(event.target.value)} placeholder="Quét camera, tải ảnh hoặc dán qr_jwt / ticket_code" />
                </label>
                <label className="grid gap-2 text-sm font-medium">Gate ID<input className="field" required maxLength={128} value={gateId} onChange={(event) => setGateId(event.target.value)} /></label>
                {environment === "test" ? (
                  <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm leading-5 text-blue-900">Chế độ test chỉ dùng test key. Hãy thử QR vừa tạo ở tab “Tạo QR API”; test key không xác minh vé show thật. QR offline RS256 cần thiết bị đã đồng bộ và xác minh theo chế độ offline.</p>
                ) : (
                  <label className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm leading-5 text-amber-950">
                    <input className="mt-1" type="checkbox" checked={liveAcknowledged} onChange={(event) => setLiveAcknowledged(event.target.checked)} />
                    <span><b className="flex items-center gap-1"><AlertTriangle size={15} /> Xác nhận thao tác live</b>Vé hợp lệ có thể được check-in/đánh dấu đã dùng. Dùng action này có thể không hoàn tác được.</span>
                  </label>
                )}
                <button className="btn btn-primary w-fit" disabled={busy || !scanApiKey.trim() || !qrInput.trim() || (environment === "live" && !liveAcknowledged)}>
                  <ScanLine size={16} />{busy ? "Đang xác minh..." : "Gọi API xác minh"}
                </button>
              </form>
            </>
          )}
        </section>

        <aside className="grid content-start gap-4">
          {(error || result) && (
            <section className={`panel overflow-hidden ${valid ? "border-emerald-200" : rejected ? "border-red-200" : ""}`}>
              <div className={`border-b p-4 ${valid ? "border-emerald-200 bg-emerald-50" : rejected ? "border-red-200 bg-red-50" : "border-zinc-200 bg-zinc-50"}`}>
                <h2 className="flex items-center gap-2 font-semibold">
                  {valid ? <CheckCircle2 size={17} className="text-emerald-700" /> : rejected ? <XCircle size={17} className="text-red-700" /> : <ShieldCheck size={17} />}
                  {error ? "API báo lỗi" : valid ? "Kết quả hợp lệ" : result?.valid === false ? "Kết quả từ chối" : "Phản hồi API"}
                </h2>
              </div>
              <div className="p-4">
                {error && <p className="mb-3 text-sm text-red-800">{error}{error === TEST_KEY_REQUIRED_MESSAGE && <> Mở <Link className="font-semibold underline underline-offset-2" href="/dashboard/api-keys">Quản lý API key</Link>, chọn gói thuê và tạo “Test key”, rồi dán key mới vào đây.</>}</p>}
                {result && <pre className="max-h-80 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs leading-5 text-zinc-100">{JSON.stringify(result, null, 2)}</pre>}
              </div>
            </section>
          )}
          {createdQr && (
            <section className="panel p-5">
              <div className="flex items-center gap-2 font-semibold"><CheckCircle2 size={17} className="text-emerald-700" />QR {createdQr.is_test ? "test" : "live"} đã tạo</div>
              <div className="mt-4 flex justify-center rounded-lg border border-zinc-200 bg-white p-4">
                <QRCodeSVG id="test-created-qr" value={createdQr.ticket_code} size={240} level="H" includeMargin />
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-500">QR dùng ticket code ngắn để camera dễ quét hơn; API xác minh vẫn nhận mã này hoặc JWT.</p>
              <p className="mt-4 text-xs text-zinc-500">Ticket code</p>
              <p className="mt-1 break-all rounded-lg bg-zinc-50 p-3 font-mono text-sm">{createdQr.ticket_code}</p>
              <p className="mt-3 text-xs text-zinc-500">Hết hạn: {new Date(createdQr.expires_at).toLocaleString("vi-VN")}</p>
              <button className="btn btn-secondary mt-3 w-full text-sm" onClick={() => void downloadCreatedQr()}>
                <Download size={15} /> Tải mã QR (PNG)
              </button>
              <button className="btn btn-secondary mt-3 w-full text-sm" onClick={() => { setMode("scan"); setQrInput(createdQr.ticket_code); setResult(null); setError(""); }}>
                <ScanLine size={15} /> Dùng thử xác minh QR này
              </button>
            </section>
          )}
          <section className="panel p-5">
            <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck size={17} />An toàn khi kiểm thử</h2>
            <ul className="mt-3 grid gap-2 text-sm leading-5 text-zinc-600">
              <li>• API key chỉ lưu trong state của tab, tải lại trang sẽ xóa.</li>
              <li>• Sandbox chỉ nhận test key; live sử dụng key production có scope phù hợp.</li>
              <li>• Tạo QR live có thể tiêu quota/phát sinh phí; xác minh live có thể ghi nhận check-in.</li>
              <li>• Camera chỉ hoạt động trên HTTPS hoặc localhost.</li>
            </ul>
          </section>
        </aside>
      </div>
      <p className="mt-5 text-xs text-zinc-500">API endpoint: <code>{API_URL}</code> · Mỗi tab có ô dán API key riêng; key không được lưu vào localStorage.</p>
    </div>
  );
}

function extractQrValue(input: string) {
  const value = input.trim();
  if (!value) return "";
  try {
    const parsed = JSON.parse(value) as { qr_jwt?: string; ticket_code?: string; qr?: { value?: string; code?: string } };
    return parsed.qr_jwt ?? parsed.ticket_code ?? parsed.qr?.value ?? parsed.qr?.code ?? value;
  } catch {
    return value;
  }
}
