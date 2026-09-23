import { Body, Controller, Get, Headers, Param, Post, Res } from "@nestjs/common";
import { Response } from "express";
import { ApiBulkCreateQrDto, ApiCreateQrDto } from "../api-qr.dto";
import { QrPlatformService } from "../services/qr-platform.service";

@Controller("api/v1/qr-codes")
export class QrCodesController {
  constructor(private readonly platform: QrPlatformService) {}
  @Post()
  create(@Body() dto: ApiCreateQrDto, @Headers("x-api-key") apiKey?: string, @Headers("idempotency-key") key?: string) {
    return this.platform.createExternalQrCode(dto, apiKey, key);
  }
  @Post("bulk")
  bulk(@Body() dto: ApiBulkCreateQrDto, @Headers("x-api-key") apiKey?: string, @Headers("idempotency-key") key?: string) {
    return this.platform.createBulk(dto.resources, apiKey, key);
  }
  @Get(":id")
  get(@Param("id") id: string, @Headers("x-api-key") apiKey?: string) { return this.platform.getExternalQrCode(id, apiKey); }
  @Post(":id/revoke")
  revoke(@Param("id") id: string, @Headers("x-api-key") apiKey?: string, @Headers("idempotency-key") key?: string) { return this.platform.revoke(id, apiKey, key); }
  @Get(":id/svg")
  async svg(@Param("id") id: string, @Headers("x-api-key") apiKey: string | undefined, @Res() res: Response) {
    const svg = await this.platform.getExternalQrSvg(id, apiKey);
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(svg);
  }
}
