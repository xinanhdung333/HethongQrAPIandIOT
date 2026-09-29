"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhooksController = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = __importDefault(require("crypto"));
const dto_1 = require("../dto");
const platform_service_1 = require("../services/platform.service");
const redis_service_1 = require("../services/redis.service");
let WebhooksController = class WebhooksController {
    platform;
    redis;
    constructor(platform, redis) {
        this.platform = platform;
        this.redis = redis;
    }
    async webhook(dto, timestamp, nonce, signature, paymentExpires, paymentSignature, req) {
        if (paymentExpires && paymentSignature) {
            await this.verifyPaymentLink(dto.order_id, dto.kind, paymentExpires, paymentSignature);
        }
        else {
            await this.verifyPayosDemo(timestamp, nonce, signature, req?.rawBody ?? Buffer.from(JSON.stringify(dto)));
        }
        return this.platform.webhook(dto.order_id, dto.kind);
    }
    async verifyPaymentLink(orderId, kind, expires, signature) {
        if (process.env.PAYMENT_DEMO_MODE !== "true" || process.env.NODE_ENV === "production") {
            throw new common_1.ForbiddenException({ error: "demo_payment_disabled", message: "Demo payment callbacks are disabled" });
        }
        const expiry = Number(expires);
        if (!Number.isInteger(expiry) || expiry < Math.floor(Date.now() / 1000)) {
            throw new common_1.UnauthorizedException({ error: "payment_link_expired", message: "Payment link has expired" });
        }
        const secret = process.env.PAYMENT_LINK_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "payment-link-dev-secret");
        if (!secret)
            throw new common_1.UnauthorizedException({ error: "payment_link_secret_required", message: "PAYMENT_LINK_SECRET is required" });
        const expected = crypto_1.default.createHmac("sha256", secret).update(`${orderId}.${kind ?? "ticket"}.${expiry}`).digest("hex");
        const left = Buffer.from(signature);
        const right = Buffer.from(expected);
        if (left.length !== right.length || !crypto_1.default.timingSafeEqual(left, right)) {
            throw new common_1.UnauthorizedException({ error: "invalid_payment_link", message: "Payment link signature is invalid" });
        }
        const ttlSeconds = Math.max(1, expiry - Math.floor(Date.now() / 1000));
        if (!(await this.redis.setIfAbsent(`payment:link:${signature}`, "1", ttlSeconds))) {
            throw new common_1.UnauthorizedException({ error: "payment_link_replayed", message: "Payment link has already been used" });
        }
    }
    async verifyPayosDemo(timestamp, nonce, signature, rawBody = Buffer.alloc(0)) {
        const secret = process.env.PAYOS_WEBHOOK_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "payos-demo-dev-secret");
        if (!secret)
            throw new common_1.UnauthorizedException({ error: "payos_secret_required", message: "PAYOS_WEBHOOK_SECRET is required" });
        const ts = Number(timestamp);
        if (!timestamp || !Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) {
            throw new common_1.UnauthorizedException({ error: "invalid_timestamp", message: "Webhook timestamp is invalid or expired" });
        }
        if (!nonce || !/^[a-zA-Z0-9_-]{12,80}$/.test(nonce))
            throw new common_1.BadRequestException({ error: "invalid_nonce", message: "Webhook nonce is invalid" });
        const replayKey = `payos:webhook:nonce:${nonce}`;
        const expected = `sha256=${crypto_1.default.createHmac("sha256", secret).update(`${timestamp}.${nonce}.`).update(rawBody).digest("hex")}`;
        const left = Buffer.from(signature ?? "");
        const right = Buffer.from(expected);
        if (left.length !== right.length || !crypto_1.default.timingSafeEqual(left, right)) {
            throw new common_1.UnauthorizedException({ error: "invalid_signature", message: "Webhook signature is invalid" });
        }
        if (!(await this.redis.setIfAbsent(replayKey, "1", 600))) {
            throw new common_1.UnauthorizedException({ error: "replay_detected", message: "Webhook nonce was already used" });
        }
    }
};
exports.WebhooksController = WebhooksController;
__decorate([
    (0, common_1.Post)("payos-demo"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)("x-payos-timestamp")),
    __param(2, (0, common_1.Headers)("x-payos-nonce")),
    __param(3, (0, common_1.Headers)("x-payos-signature")),
    __param(4, (0, common_1.Headers)("x-payment-expires")),
    __param(5, (0, common_1.Headers)("x-payment-signature")),
    __param(6, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.PayosWebhookDto, String, String, String, String, String, Object]),
    __metadata("design:returntype", Promise)
], WebhooksController.prototype, "webhook", null);
exports.WebhooksController = WebhooksController = __decorate([
    (0, common_1.Controller)("webhooks"),
    __metadata("design:paramtypes", [platform_service_1.PlatformService, redis_service_1.RedisService])
], WebhooksController);
