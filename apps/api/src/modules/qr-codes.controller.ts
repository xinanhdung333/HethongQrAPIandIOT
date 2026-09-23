import { Body, Controller, Get, Headers, HttpException, Param, Post, Res, ServiceUnavailableException } from "@nestjs/common";
import { Response } from "express";
import { ApiBulkCreateQrDto, ApiCreateQrDto } from "../api-qr.dto";
import { RequireApiKey } from "../security/api-key.decorator";
import { QrPlatformService } from "../services/qr-platform.service";

@Controller("api/v1/qr-codes")
export class QrCodesController {
  constructor(private readonly platform: QrPlatformService) {}

  @Post()
  @RequireApiKey("qr:create")
  create(@Body() dto: ApiCreateQrDto, @Headers("x-api-key") apiKey?: string, @Headers("idempotency-key") idempotencyKey?: string) {
    return this.forward("POST", "", apiKey, dto, idempotencyKey);
  }

  @Post("bulk")
  @RequireApiKey("qr:create")
  bulk(@Body() dto: ApiBulkCreateQrDto, @Headers("x-api-key") apiKey?: string, @Headers("idempotency-key") idempotencyKey?: string) {
    return this.forward("POST", "/bulk", apiKey, dto, idempotencyKey);
  }

  @Get(":id")
  @RequireApiKey("qr:read")
  get(@Param("id") id: string, @Headers("x-api-key") headerApiKey: string | undefined) {
    return this.forward("GET", `/${encodeURIComponent(id)}`, headerApiKey);
  }

  @Post(":id/revoke")
  @RequireApiKey("qr:create")
  revoke(@Param("id") id: string, @Headers("x-api-key") headerApiKey: string | undefined, @Headers("idempotency-key") idempotencyKey?: string) {
    return this.forward("POST", `/${encodeURIComponent(id)}/revoke`, headerApiKey, undefined, idempotencyKey);
  }

  @Get(":id/svg")
  @RequireApiKey("qr:read")
  async svg(
    @Param("id") id: string,
    @Headers("x-api-key") headerApiKey: string | undefined,
    @Res() res: Response
  ) {
    const base = process.env.QR_SERVICE_URL ?? "http://localhost:3005";
    let response: Awaited<ReturnType<typeof fetch>>;
    try {
      response = await fetch(`${base}/api/v1/qr-codes/${encodeURIComponent(id)}/svg`, {
        headers: { "x-api-key": headerApiKey ?? "" },
        signal: AbortSignal.timeout(5000)
      });
    } catch (error) {
      throw new ServiceUnavailableException({ error: "qr_service_unavailable", message: "QR service is unavailable" }, { cause: error instanceof Error ? error : undefined });
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "qr_service_error", message: "QR service request failed" }));
      throw new HttpException(payload, response.status);
    }
    const svg = await response.text();
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(svg);
  }

  private async forward(method: "GET" | "POST", path: string, apiKey?: string, body?: unknown, idempotencyKey?: string) {
    const base = process.env.QR_SERVICE_URL ?? "http://localhost:3005";
    try {
      const response = await fetch(`${base}/api/v1/qr-codes${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey ?? "",
          ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {})
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(5000)
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new HttpException(payload ?? { error: "qr_service_error", message: "QR service request failed" }, response.status);
      return payload;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException({ error: "qr_service_unavailable", message: "QR service is unavailable" });
    }
  }
}
