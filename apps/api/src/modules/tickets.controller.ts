import { Body, Controller, Headers, Post, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { ApiVerifyQrDto } from "../api-qr.dto";
import { PlatformService } from "../services/platform.service";
import { QrPlatformService } from "../services/qr-platform.service";
import { RequireApiKey } from "../security/api-key.decorator";

@Controller("api/v1/tickets")
export class TicketsController {
  constructor(private readonly platform: PlatformService, private readonly qrPlatform: QrPlatformService) {}

  @Post("verify")
  @RequireApiKey("ticket:verify")
  async verify(@Body() dto: ApiVerifyQrDto, @Headers("x-api-key") apiKey: string | undefined, @Headers("idempotency-key") idempotencyKey: string | undefined, @Query("api_key") queryApiKey: string | undefined, @Req() req: Request) {
    const userAgent = req.headers["user-agent"];
    const result = await this.qrPlatform.verifyExternal(dto, apiKey ?? queryApiKey, { ip: req.ip, userAgent: Array.isArray(userAgent) ? userAgent.join(", ") : userAgent }, idempotencyKey, true);
    if (result) return result;
    return this.platform.verifyTicket(dto, apiKey ?? queryApiKey, { ip: req.ip, userAgent: Array.isArray(userAgent) ? userAgent.join(", ") : userAgent });
  }
}
