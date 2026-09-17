import { Injectable } from "@nestjs/common";
import crypto from "crypto";

@Injectable()
export class PayosMockService {
  createPaymentLink(input: { orderId: string; amount: number; kind: "rental" | "ticket" | "api" }) {
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
}
