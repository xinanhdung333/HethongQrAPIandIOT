import { BadRequestException, Injectable } from "@nestjs/common";
import crypto from "crypto";

export type PaymentMethod = "payos_demo" | "momo";
type PaymentKind = "rental" | "ticket" | "api";
type PaymentLinkInput = { orderId: string; amount: number; kind: PaymentKind; method?: PaymentMethod };

@Injectable()
export class PayosMockService {
  async createPaymentLink(input: PaymentLinkInput) {
    if (input.method === "momo") return this.createMomoPaymentLink(input);
    return this.createPayosDemoLink(input);
  }

  private createPayosDemoLink(input: PaymentLinkInput) {
    const baseUrl = process.env.WEB_ORIGIN ?? "http://localhost:3000";
    const expires = Math.floor(Date.now() / 1000) + 30 * 60;
    const secret = process.env.PAYMENT_LINK_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "payment-link-dev-secret");
    if (!secret) throw new Error("PAYMENT_LINK_SECRET is required");
    const signature = crypto.createHmac("sha256", secret).update(`${input.orderId}.${input.kind}.${expires}`).digest("hex");
    const query = `order_id=${encodeURIComponent(input.orderId)}&kind=${input.kind}&expires=${expires}&signature=${signature}`;
    return {
      paymentId: `payos_demo_${input.orderId}`,
      paymentUrl: `${baseUrl}/thanh-toan-demo?${query}`,
      checkoutUrl: `${baseUrl}/thanh-toan-demo?${query}`
    };
  }

  private async createMomoPaymentLink(input: PaymentLinkInput) {
    const partnerCode = process.env.MOMO_PARTNER_CODE?.trim() || "MOMO";
    const accessKey = process.env.MOMO_ACCESS_KEY?.trim() || "F8BBA842ECF85";
    const secretKey = process.env.MOMO_SECRET_KEY?.trim() || "K951B6PE1waDMi640xX08PD3vg6EkVlz";
    const endpoint = process.env.MOMO_ENDPOINT?.trim() || "https://test-payment.momo.vn/v2/gateway/api/create";
    const baseUrl = process.env.WEB_ORIGIN?.trim() || "http://localhost:3000";
    const apiUrl = process.env.API_PUBLIC_URL?.trim() || `http://localhost:${process.env.PORT ?? 4000}`;
    const requestId = `${partnerCode}${Date.now()}`;
    const orderInfo = `SmartQR ${input.kind} ${input.orderId}`;
    const redirectUrl = `${baseUrl}/thanh-toan-demo?order_id=${encodeURIComponent(input.orderId)}&kind=${input.kind}&gateway=momo`;
    const ipnUrl = process.env.MOMO_IPN_URL?.trim() || `${apiUrl}/webhooks/momo`;
    const requestType = "payWithATM";
    const extraData = "";
    const amount = String(Math.max(1000, Math.round(input.amount)));
    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${input.orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
    const signature = crypto.createHmac("sha256", secretKey).update(rawSignature).digest("hex");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partnerCode,
        accessKey,
        requestId,
        amount,
        orderId: input.orderId,
        orderInfo,
        redirectUrl,
        ipnUrl,
        extraData,
        requestType,
        signature,
        lang: "vi"
      }),
      signal: AbortSignal.timeout(10000)
    });
    const body = await response.json().catch(() => null) as { payUrl?: string; deeplink?: string; resultCode?: number; message?: string } | null;
    if (!response.ok || !body?.payUrl) {
      throw new BadRequestException({ error: "momo_payment_failed", message: body?.message ?? "MoMo sandbox did not return a payment URL" });
    }
    return {
      paymentId: `momo_${input.orderId}`,
      paymentUrl: body.payUrl,
      checkoutUrl: body.payUrl
    };
  }
}
