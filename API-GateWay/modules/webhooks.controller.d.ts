import { Request } from "express";
import { PayosWebhookDto } from "../dto";
import { PlatformService } from "../services/platform.service";
import { RedisService } from "../services/redis.service";
export declare class WebhooksController {
    private readonly platform;
    private readonly redis;
    constructor(platform: PlatformService, redis: RedisService);
    webhook(dto: PayosWebhookDto, timestamp?: string, nonce?: string, signature?: string, paymentExpires?: string, paymentSignature?: string, req?: Request & {
        rawBody?: Buffer;
    }): Promise<any>;
    private verifyPaymentLink;
    private verifyPayosDemo;
}
