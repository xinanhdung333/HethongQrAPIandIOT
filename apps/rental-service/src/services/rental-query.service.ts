import { BadRequestException, Injectable } from "@nestjs/common";
import { RentalStatus } from "@prisma/client";
import crypto from "crypto";
import { PrismaService } from "./prisma.service";

type PaymentMethod = "payos_demo" | "momo";

@Injectable()
export class RentalQueryService {
  constructor(private readonly prisma: PrismaService) {}
  list(userId: string) {
    return this.prisma.apiRentalOrder.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  }

  async create(userId: string, body: { app_name?: string; website?: string; callback_url?: string; plan?: "starter" | "business"; duration?: number; scopes?: string[]; payment_method?: PaymentMethod }) {
    if (!body.app_name?.trim()) throw new BadRequestException({ error: "invalid_app_name", message: "app_name is required" });
    if (body.plan !== "starter" && body.plan !== "business") throw new BadRequestException({ error: "invalid_plan", message: "plan must be starter or business" });
    if (!Array.isArray(body.scopes) || !body.scopes.length) throw new BadRequestException({ error: "invalid_scopes", message: "Choose at least one API key scope" });
    const duration = [1, 3, 12].includes(body.duration ?? 0) ? body.duration! : 1;
    const plan = body.plan === "business"
      ? { price: 499000, quota: 30000 }
      : { price: 199000, quota: 5000 };
    const order = await this.prisma.apiRentalOrder.create({
      data: {
        userId,
        appName: body.app_name.trim(),
        website: body.website?.trim() || null,
        callbackUrl: body.callback_url?.trim() || null,
        plan: body.plan,
        duration,
        quota: plan.quota,
        scopes: body.scopes,
        total: plan.price * duration,
        status: RentalStatus.PENDING
      }
    });
    const paymentUrl = body.payment_method === "momo"
      ? await this.createMomoPaymentUrl(order.id, plan.price * duration)
      : this.createPayosDemoUrl(order.id);
    return {
      payment_url: paymentUrl,
      order_id: order.id,
      breakdown: { monthly_price: plan.price, duration, quota: plan.quota, total: plan.price * duration }
    };
  }

  private createPayosDemoUrl(orderId: string) {
    const expires = Math.floor(Date.now() / 1000) + 1800;
    const secret = process.env.PAYMENT_LINK_SECRET ?? "payment-link-dev-secret";
    const signature = crypto.createHmac("sha256", secret).update(`${orderId}.api.${expires}`).digest("hex");
    return `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/thanh-toan-demo?order_id=${encodeURIComponent(orderId)}&kind=api&expires=${expires}&signature=${signature}`;
  }

  private async createMomoPaymentUrl(orderId: string, total: number) {
    const partnerCode = process.env.MOMO_PARTNER_CODE?.trim() || "MOMO";
    const accessKey = process.env.MOMO_ACCESS_KEY?.trim() || "F8BBA842ECF85";
    const secretKey = process.env.MOMO_SECRET_KEY?.trim() || "K951B6PE1waDMi640xX08PD3vg6EkVlz";
    const endpoint = process.env.MOMO_ENDPOINT?.trim() || "https://test-payment.momo.vn/v2/gateway/api/create";
    const baseUrl = process.env.WEB_ORIGIN?.trim() || "http://localhost:3000";
    const apiUrl = process.env.API_PUBLIC_URL?.trim() || "http://localhost:4000";
    const requestId = `${partnerCode}${Date.now()}`;
    const orderInfo = `SmartQR api ${orderId}`;
    const redirectUrl = `${baseUrl}/thanh-toan-demo?order_id=${encodeURIComponent(orderId)}&kind=api&gateway=momo`;
    const ipnUrl = process.env.MOMO_IPN_URL?.trim() || `${apiUrl}/webhooks/momo`;
    const requestType = "captureWallet";
    const extraData = "";
    const amount = String(Math.max(1000, Math.round(total)));
    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
    const signature = crypto.createHmac("sha256", secretKey).update(rawSignature).digest("hex");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partnerCode, accessKey, requestId, amount, orderId, orderInfo, redirectUrl, ipnUrl, extraData, requestType, signature, lang: "vi" }),
      signal: AbortSignal.timeout(10000)
    });
    const body = await response.json().catch(() => null) as { payUrl?: string; message?: string } | null;
    if (!response.ok || !body?.payUrl) throw new BadRequestException({ error: "momo_payment_failed", message: body?.message ?? "MoMo sandbox did not return a payment URL" });
    return body.payUrl;
  }
}
