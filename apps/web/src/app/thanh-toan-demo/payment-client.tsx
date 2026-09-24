"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Copy, Download, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { API_URL, api } from "@/lib/api";

type PaidTicket = { id: string; qrJwt: string; qrOfflineJwt?: string | null; isUsed: boolean };
type PaidTicketOrder = {
  id: string;
  status: string;
  quantity: number;
  tickets?: PaidTicket[];
};
type PaidApiRental = {
  id: string;
  status: string;
  api_key_once?: string;
  apiKeyPrefix?: string;
};

export function PaymentClient() {
  const search = useSearchParams();
  const orderId = search.get("order_id") || "";
  const kind = search.get("kind") || "ticket";
  const paymentExpires = search.get("expires") || "";
  const paymentSignature = search.get("signature") || "";
  const enableOfflineRsa = search.get("enable_offline_rsa") === "1";
  const [status, setStatus] = useState<"waiting" | "paid" | "error">("waiting");
  const [seconds, setSeconds] = useState(5);
  const [tickets, setTickets] = useState<PaidTicket[]>([]);
  const [apiKeyOnce, setApiKeyOnce] = useState("");
  const [message, setMessage] = useState("");
  const backHref = useMemo(() => kind === "rental" ? "/dashboard/rentals" : kind === "api" ? "/thue-api" : "/dashboard/tickets", [kind]);

  useEffect(() => {
    const tick = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    const timer = window.setTimeout(async () => {
      try {
        const body = JSON.stringify({ order_id: orderId, kind });
        const result = await api<PaidTicketOrder | unknown>("/webhooks/payos-demo", {
          method: "POST",
          headers: { "X-Payment-Expires": paymentExpires, "X-Payment-Signature": paymentSignature },
          body
        });
        if (kind === "ticket" && result && typeof result === "object" && "tickets" in result) {
          setTickets(((result as PaidTicketOrder).tickets ?? []).filter((ticket) => ticket.qrJwt));
        }
        if (kind === "api" && result && typeof result === "object" && "api_key_once" in result) {
          const rawKey = String((result as PaidApiRental).api_key_once ?? "");
          setApiKeyOnce(rawKey);
          if (enableOfflineRsa && rawKey) {
            try {
              const enableResponse = await fetch(`${API_URL}/api/v1/gates/tenant-settings/enable-offline`, {
                method: "POST",
                headers: { "x-api-key": rawKey }
              });
              if (!enableResponse.ok) {
                setMessage("Da tao API key thanh cong, nhung bat che do RSA that bai. Ban co the tu bat lai sau trong Developer Console tai dashboard/api-keys.");
              }
            } catch {
              setMessage("Da tao API key thanh cong, nhung bat che do RSA that bai. Ban co the tu bat lai sau trong Developer Console tai dashboard/api-keys.");
            }
          }
        }
        setStatus("paid");
      } catch (error) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Không thể xác nhận thanh toán demo.");
      } finally {
        window.clearInterval(tick);
      }
    }, 5000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(tick);
    };
  }, [enableOfflineRsa, kind, orderId, paymentExpires, paymentSignature]);

  return (
    <main className="shell py-16">
      <section className="panel mx-auto max-w-3xl p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-100">
          {status === "waiting" ? <Loader2 className="animate-spin text-zinc-900" /> : <CheckCircle2 className={status === "paid" ? "text-emerald-600" : "text-red-600"} />}
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">{status === "paid" ? "Đã thanh toán demo" : status === "error" ? "Thanh toán demo lỗi" : "PayOS DEMO MOCK"}</h1>
        <p className="mt-3 text-zinc-600">Đơn {orderId}. Số tiền được xác nhận từ dữ liệu đơn hàng.</p>
        {status === "waiting" && <p className="mt-4 text-sm text-zinc-500">Tự paid sau {seconds}s</p>}
        {message && <p className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">{message}</p>}
      </section>

      {status === "paid" && kind === "ticket" && (
        <section className="mx-auto mt-8 max-w-5xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-500">Vé đã phát hành</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">{tickets.length} mã QR check-in</h2>
            </div>
            <Link href="/dashboard/scan" className="btn btn-secondary text-sm">Mở trang quét</Link>
          </div>

          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
            <ShieldCheck className="mr-2 inline text-zinc-900" size={16} />
            QR và chuỗi code đều là JWT ký số, có jti riêng cho từng vé. Mã bị che mặc định, chỉ mở trong thời gian ngắn và sẽ hết hiệu lực ngay sau khi quét thành công.
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {tickets.map((ticket, index) => (
              <TicketCard key={ticket.id} ticket={ticket} index={index + 1} />
            ))}
          </div>
        </section>
      )}

      {status === "paid" && kind === "api" && apiKeyOnce && (
        <section className="panel mx-auto mt-8 max-w-3xl p-6">
          <p className="text-sm font-medium text-zinc-500">API key đã cấp</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Lưu raw key ngay bây giờ</h2>
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <ShieldCheck className="mt-0.5 shrink-0" size={18} />
            <p>Đây là lần duy nhất bạn nhìn thấy key này. SmartQR không lưu key đầy đủ, kể cả admin cũng không thể xem lại. Nếu rời trang trước khi lưu, bạn sẽ phải cấp lại (rotate) key mới trong Developer Console.</p>
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            SmartQR chỉ hiển thị raw API key một lần. Sau đó dashboard chỉ còn prefix để theo dõi.
          </p>
          <div className="mt-4 grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <code className="break-all text-sm font-semibold text-zinc-900">{apiKeyOnce}</code>
            <button className="btn btn-secondary w-fit text-sm" onClick={() => void navigator.clipboard.writeText(apiKeyOnce)}>
              <Copy size={16} />
              Copy API key
            </button>
          </div>
          <Link href="/thue-api" className="btn btn-primary mt-5 w-fit">Về Thuê API</Link>
        </section>
      )}

      {status === "paid" && kind === "api" && !apiKeyOnce && (
        <section className="panel mx-auto mt-8 max-w-3xl p-6 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Đơn thuê API đã active</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Raw API key chỉ hiển thị một lần lúc vừa paid. Dashboard vẫn lưu prefix để theo dõi quota và trạng thái.
          </p>
          <Link href="/thue-api" className="btn btn-primary mt-5">Về Thuê API</Link>
        </section>
      )}

      {status === "paid" && kind !== "api" && (kind !== "ticket" || !tickets.length) && (
        <div className="mt-8 text-center">
          <Link href={backHref} className="btn btn-primary">Về dashboard</Link>
        </div>
      )}
    </main>
  );
}

function TicketCard({ ticket, index }: { ticket: PaidTicket; index: number }) {
  const [revealed, setRevealed] = useState(false);
  const [left, setLeft] = useState(0);
  const qrId = `paid-ticket-${ticket.id}`;

  useEffect(() => {
    if (!revealed) return;
    setLeft(20);
    const timer = window.setInterval(() => {
      setLeft((value) => {
        if (value <= 1) {
          setRevealed(false);
          window.clearInterval(timer);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [revealed]);

  async function copyCode() {
    await navigator.clipboard.writeText(ticket.qrJwt);
  }

  function downloadQr() {
    const svg = document.getElementById(qrId);
    if (!svg) return;
    const serialized = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const anchor = document.createElement("a");
      anchor.href = canvas.toDataURL("image/png");
      anchor.download = `smartqr-ticket-${index}.png`;
      anchor.click();
      URL.revokeObjectURL(url);
    };
    image.src = url;
  }

  return (
    <article className="panel p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <b>Vé #{index}</b>
          <p className="mt-1 text-sm text-zinc-500">JWT dùng một lần</p>
        </div>
        <button className="btn btn-secondary text-sm" onClick={() => setRevealed((value) => !value)}>
          {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
          {revealed ? `Ẩn (${left}s)` : "Mở mã"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[160px_1fr]">
        <div className="relative flex aspect-square items-center justify-center rounded-lg border border-zinc-200 bg-white p-4">
          <div className={revealed ? "" : "blur-md"}>
            <QRCodeSVG id={qrId} value={ticket.qrOfflineJwt ?? ticket.qrJwt} size={128} level="H" includeMargin />
          </div>
          {!revealed && <span className="absolute rounded-lg bg-white/90 px-3 py-1 text-xs font-medium text-zinc-700">Đang che</span>}
        </div>
        <div className="grid gap-3">
          <label className="grid gap-2 text-sm font-medium">
            Chuỗi code check vé
            <textarea className="field min-h-24 text-xs" value={revealed ? ticket.qrJwt : "Bấm Mở mã để xem chuỗi JWT"} readOnly />
            {ticket.qrOfflineJwt && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-left">
                <p className="text-xs font-semibold text-emerald-800">Offline JWT (RS256)</p>
                <p className="mt-1 line-clamp-2 break-all text-xs text-emerald-700">{ticket.qrOfflineJwt}</p>
                <button className="btn btn-secondary mt-3 text-xs" onClick={() => void navigator.clipboard.writeText(ticket.qrOfflineJwt!)}>
                  <Copy size={14} />
                  Copy offline JWT
                </button>
              </div>
            )}
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-secondary text-sm" disabled={!revealed} onClick={copyCode}>
              <Copy size={16} />
              Copy code
            </button>
            <button className="btn btn-secondary text-sm" disabled={!revealed} onClick={downloadQr}>
              <Download size={16} />
              Tải QR PNG
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
