import { Body, Controller, Get, Headers, Param, Post, Query, Res } from "@nestjs/common";
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
    return this.platform.createExternalQrCode(dto, apiKey, idempotencyKey);
  }

  @Post("bulk")
  @RequireApiKey("qr:create")
  bulk(@Body() dto: ApiBulkCreateQrDto, @Headers("x-api-key") apiKey?: string, @Headers("idempotency-key") idempotencyKey?: string) {
    return this.platform.createBulk(dto.resources, apiKey, idempotencyKey);
  }

  @Get(":id")
  @RequireApiKey("qr:read")
  get(@Param("id") id: string, @Headers("x-api-key") headerApiKey: string | undefined, @Query("api_key") queryApiKey: string | undefined) {
    return this.platform.getExternalQrCode(id, headerApiKey ?? queryApiKey);
  }

  @Post(":id/revoke")
  @RequireApiKey("qr:create")
  revoke(@Param("id") id: string, @Headers("x-api-key") headerApiKey: string | undefined, @Headers("idempotency-key") idempotencyKey?: string) {
    return this.platform.revoke(id, headerApiKey, idempotencyKey);
  }

  @Get(":id/svg")
  @RequireApiKey("qr:read")
  async svg(
    @Param("id") id: string,
    @Headers("x-api-key") headerApiKey: string | undefined,
    @Query("api_key") queryApiKey: string | undefined,
    @Res() res: Response
  ) {
    const svg = await this.platform.getExternalQrSvg(id, headerApiKey ?? queryApiKey);
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(svg);
  }
}
