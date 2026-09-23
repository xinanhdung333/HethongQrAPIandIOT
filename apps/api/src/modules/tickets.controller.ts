import { Body, Controller, Headers, HttpException, Param, Post, Req, ServiceUnavailableException } from "@nestjs/common";
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
  async verify(@Body() dto: ApiVerifyQrDto, @Headers("x-api-key") apiKey: string | undefined, @Headers("idempotency-key") idempotencyKey: string | undefined, @Req() req: Request) {
    // Legacy direct-ticket logic kept here as rollback reference:
    // const userAgent = req.headers["user-agent"];
    // const result = await this.qrPlatform.verifyExternal(dto, apiKey, { ip: req.ip, userAgent: Array.isArray(userAgent) ? userAgent.join(", ") : userAgent }, idempotencyKey, true);
    // if (result) return result;
    // return this.platform.verifyTicket(dto, apiKey, { ip: req.ip, userAgent: Array.isArray(userAgent) ? userAgent.join(", ") : userAgent });
    const userAgent = req.headers["user-agent"];
    const ticketServiceUrl = process.env.TICKET_SERVICE_URL ?? "http://localhost:3003";
    let response: Awaited<ReturnType<typeof fetch>>;
    try {
      response = await fetch(`${ticketServiceUrl}/api/v1/tickets/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey ?? "",
          ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
          "user-agent": Array.isArray(userAgent) ? userAgent.join(", ") : userAgent ?? ""
        },
        body: JSON.stringify(dto),
        signal: AbortSignal.timeout(5000)
      });
    } catch (error) {
      throw new ServiceUnavailableException({
        error: "ticket_service_unavailable",
        message: "Ticket service is unavailable"
      }, { cause: error instanceof Error ? error : undefined });
    }

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "ticket_service_unavailable", message: "Ticket service is unavailable" }));
      throw new HttpException({
        error: payload?.error ?? "ticket_service_unavailable",
        message: payload?.message ?? "Ticket service is unavailable"
      }, response.status || 503);
    }

    return response.json();
  }

  @Post(":id/revoke")
  @RequireApiKey("qr:create")
  revoke(@Param("id") id: string, @Headers("x-api-key") apiKey: string | undefined) {
    return this.platform.revokeTicket(id, apiKey);
  }
}
