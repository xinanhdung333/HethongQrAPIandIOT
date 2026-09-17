import { BadRequestException, Body, Controller, Headers, Post, Req, UnauthorizedException } from "@nestjs/common";
import crypto from "crypto";
import { Request } from "express";
import { PayosWebhookDto } from "../dto";
import { PlatformService } from "../services/platform.service";
import { RedisService } from "../services/redis.service";

@Controller("webhooks")
export class WebhooksController {
  constructor(private readonly platform: PlatformService, private readonly redis: RedisService) {}

  @Post("payos-demo")
  async webhook(@Body() dto: PayosWebhookDto, @Headers("x-payos-timestamp") timestamp?: string, @Headers("x-payos-nonce") nonce?: string, @Headers("x-payos-signature") signature?: string, @Headers("x-payment-expires") paymentExpires?: string, @Headers("x-payment-signature") paymentSignature?: string, @Req() req?: Request & { rawBody?: Buffer }) {
    if (paymentExpires && paymentSignature) {
      this.verifyPaymentLink(dto.order_id, dto.kind, paymentExpires, paymentSignature);
    } else {
      await this.verifyPayosDemo(timestamp, nonce, signature, req?.rawBody ?? Buffer.from(JSON.stringify(dto)));
    }
    return this.platform.webhook(dto.order_id, dto.kind);
  }

  private verifyPaymentLink(orderId: string, kind: PayosWebhookDto["kind"], expires: string, signature: string) {
    const expiry = Number(expires);
    if (!Number.isInteger(expiry) || expiry < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException({ error: "payment_link_expired", message: "Payment link has expired" });
    }
    const secret = process.env.PAYMENT_LINK_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "payment-link-dev-secret");
    if (!secret) throw new UnauthorizedException({ error: "payment_link_secret_required", message: "PAYMENT_LINK_SECRET is required" });
    const expected = crypto.createHmac("sha256", secret).update(`${orderId}.${kind ?? "ticket"}.${expiry}`).digest("hex");
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
      throw new UnauthorizedException({ error: "invalid_payment_link", message: "Payment link signature is invalid" });
    }
  }

  private async verifyPayosDemo(timestamp?: string, nonce?: string, signature?: string, rawBody: Buffer = Buffer.alloc(0)) {
    const secret = process.env.PAYOS_WEBHOOK_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "payos-demo-dev-secret");
    if (!secret) throw new UnauthorizedException({ error: "payos_secret_required", message: "PAYOS_WEBHOOK_SECRET is required" });
    const ts = Number(timestamp);
    if (!timestamp || !Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) {
      throw new UnauthorizedException({ error: "invalid_timestamp", message: "Webhook timestamp is invalid or expired" });
    }
    if (!nonce || !/^[a-zA-Z0-9_-]{12,80}$/.test(nonce)) throw new BadRequestException({ error: "invalid_nonce", message: "Webhook nonce is invalid" });
    const replayKey = `payos:webhook:nonce:${nonce}`;
    const expected = `sha256=${crypto.createHmac("sha256", secret).update(`${timestamp}.${nonce}.`).update(rawBody).digest("hex")}`;
    const left = Buffer.from(signature ?? "");
    const right = Buffer.from(expected);
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
      throw new UnauthorizedException({ error: "invalid_signature", message: "Webhook signature is invalid" });
    }
    if (!(await this.redis.setIfAbsent(replayKey, "1", 600))) {
      throw new UnauthorizedException({ error: "replay_detected", message: "Webhook nonce was already used" });
    }
  }
}
