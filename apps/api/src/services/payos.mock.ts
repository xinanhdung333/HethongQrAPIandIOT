import { Injectable } from "@nestjs/common";

@Injectable()
export class PayosMockService {
  createPaymentLink(input: { orderId: string; amount: number; kind: "rental" | "ticket" | "api" }) {
    const baseUrl = process.env.WEB_ORIGIN ?? "http://localhost:3000";
    return {
      paymentId: `payos_demo_${input.orderId}`,
      paymentUrl: `${baseUrl}/thanh-toan-demo?order_id=${input.orderId}&kind=${input.kind}&amount=${input.amount}`,
      checkoutUrl: `${baseUrl}/thanh-toan-demo?order_id=${input.orderId}&kind=${input.kind}&amount=${input.amount}`
    };
  }
}
