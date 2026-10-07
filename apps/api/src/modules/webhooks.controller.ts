import { BadRequestException, Body, Controller, ForbiddenException, Headers, Post, Req, UnauthorizedException } from "@nestjs/common";
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
      await this.verifyPaymentLink(dto.order_id, dto.kind, paymentExpires, paymentSignature);
    } else {
      await this.verifyPayosDemo(timestamp, nonce, signature, req?.rawBody ?? Buffer.from(JSON.stringify(dto)));
    }
    return this.platform.webhook(dto.order_id, dto.kind);
  }

  @Post("momo")
  async momo(@Body() dto: Record<string, unknown>) {
    this.verifyMomoIpn(dto);
    const orderId = String(dto.orderId ?? "");
    if (!orderId) throw new BadRequestException({ error: "invalid_momo_order", message: "MoMo orderId is required" });
    if (Number(dto.resultCode) !== 0) {
      return { received: true, paid: false, order_id: orderId, result_code: dto.resultCode };
    }
    const paid = await this.platform.webhook(orderId);
    return { received: true, paid: true, order_id: orderId, order: paid };
  }

  private async verifyPaymentLink(orderId: string, kind: PayosWebhookDto["kind"], expires: string, signature: string) {
    if (process.env.PAYMENT_DEMO_MODE !== "true" || process.env.NODE_ENV === "production") {
      throw new ForbiddenException({ error: "demo_payment_disabled", message: "Demo payment callbacks are disabled" });
    }
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
    const ttlSeconds = Math.max(1, expiry - Math.floor(Date.now() / 1000));
    if (!(await this.redis.setIfAbsent(`payment:link:${signature}`, "1", ttlSeconds))) {
      throw new UnauthorizedException({ error: "payment_link_replayed", message: "Payment link has already been used" });
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

  private verifyMomoIpn(dto: Record<string, unknown>) {
    const accessKey = process.env.MOMO_ACCESS_KEY ?? "F8BBA842ECF85";
    const secretKey = process.env.MOMO_SECRET_KEY ?? "K951B6PE1waDMi640xX08PD3vg6EkVlz";
    const signature = String(dto.signature ?? "");
    if (!signature) throw new UnauthorizedException({ error: "missing_momo_signature", message: "Missing MoMo signature" });
    const rawSignature = [
      `accessKey=${accessKey}`,
      `amount=${dto.amount ?? ""}`,
      `extraData=${dto.extraData ?? ""}`,
      `message=${dto.message ?? ""}`,
      `orderId=${dto.orderId ?? ""}`,
      `orderInfo=${dto.orderInfo ?? ""}`,
      `orderType=${dto.orderType ?? ""}`,
      `partnerCode=${dto.partnerCode ?? ""}`,
      `payType=${dto.payType ?? ""}`,
      `requestId=${dto.requestId ?? ""}`,
      `responseTime=${dto.responseTime ?? ""}`,
      `resultCode=${dto.resultCode ?? ""}`,
      `transId=${dto.transId ?? ""}`
    ].join("&");
    const expected = crypto.createHmac("sha256", secretKey).update(rawSignature).digest("hex");
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
      throw new UnauthorizedException({ error: "invalid_momo_signature", message: "MoMo signature is invalid" });
    }
  }
}
