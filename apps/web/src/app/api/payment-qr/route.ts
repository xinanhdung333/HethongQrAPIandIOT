import { NextResponse } from "next/server";
import { API_URL } from "@/lib/api";

export const dynamic = "force-dynamic";

const allowedKinds = new Set(["rental", "ticket", "api"]);
const allowedStages = new Set(["initial", "remaining"]);

export async function GET(request: Request) {
  const source = new URL(request.url);
  const orderId = source.searchParams.get("order_id")?.trim() ?? "";
  const kind = source.searchParams.get("kind") ?? "";
  const stage = source.searchParams.get("payment_stage") || "initial";
  const expires = source.searchParams.get("expires") ?? "";
  const signature = source.searchParams.get("signature") ?? "";

  if (!orderId || !allowedKinds.has(kind) || !allowedStages.has(stage) || !/^\d+$/.test(expires) || !/^[a-f\d]{64}$/i.test(signature)) {
    return NextResponse.json({ error: "invalid_payment_qr", message: "Payment QR link is invalid." }, { status: 400 });
  }

  const query = new URLSearchParams({
    order_id: orderId,
    kind,
    payment_stage: stage,
    expires,
    signature
  });

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/webhooks/payos-demo/qr?${query.toString()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20000)
    });
  } catch {
    return NextResponse.json({ error: "payment_qr_unavailable", message: "Không kết nối được API để tạo mã thanh toán." }, {
      status: 502,
      headers: { "Cache-Control": "no-store" }
    });
  }

  const headers = new Headers({
    "Cache-Control": "no-store, private",
    "X-Content-Type-Options": "nosniff"
  });
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !contentType.toLowerCase().includes("image/png")) {
    headers.set("Content-Type", contentType || "application/json; charset=utf-8");
    return new Response(await upstream.arrayBuffer(), {
      status: upstream.ok ? 502 : upstream.status,
      headers
    });
  }

  headers.set("Content-Type", "image/png");
  return new Response(await upstream.arrayBuffer(), { status: 200, headers });
}
