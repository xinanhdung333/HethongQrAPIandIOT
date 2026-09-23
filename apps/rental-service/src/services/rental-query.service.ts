import { BadRequestException, Injectable } from "@nestjs/common";
import { RentalStatus } from "@prisma/client";
import crypto from "crypto";
import { PrismaService } from "./prisma.service";

@Injectable()
export class RentalQueryService {
  constructor(private readonly prisma: PrismaService) {}
  list(userId: string) {
    return this.prisma.apiRentalOrder.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  }

  async create(userId: string, body: { app_name?: string; website?: string; callback_url?: string; plan?: "starter" | "business"; duration?: number; scopes?: string[] }) {
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
    const expires = Math.floor(Date.now() / 1000) + 1800;
    const secret = process.env.PAYMENT_LINK_SECRET ?? "payment-link-dev-secret";
    const signature = crypto.createHmac("sha256", secret).update(`${order.id}.api.${expires}`).digest("hex");
    return {
      payment_url: `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/thanh-toan-demo?order_id=${encodeURIComponent(order.id)}&kind=api&expires=${expires}&signature=${signature}`,
      order_id: order.id,
      breakdown: { monthly_price: plan.price, duration, quota: plan.quota, total: plan.price * duration }
    };
  }
}
