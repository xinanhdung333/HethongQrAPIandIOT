import { Body, Controller, Get, Headers, HttpException, Param, Patch, Post, Req, Res, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { Request, Response } from "express";
import { ApiRentalDto, UpdateApiKeyScopesDto } from "../dto";
import { AuthService } from "../security/auth.service";
import { ActivityLogService } from "../services/activity-log.service";
import { PlatformService } from "../services/platform.service";

@Controller("api-rentals")
export class ApiRentalsController {
  constructor(private readonly platform: PlatformService, private readonly auth: AuthService, private readonly activity: ActivityLogService) {}

  @Get()
  async list(@Headers("authorization") authorization: string | undefined, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.allowCustomerOnly(authorization, res);
    if (!session) return;
    const orders = await this.forward("GET", "/api-rentals", session.sub);
    await this.activity.record({ session, action: "LIST_API_RENTALS", targetType: "ApiRentalOrder", metadata: { count: orders.length }, req });
    return orders;
  }

  @Post()
  async create(@Body() dto: ApiRentalDto, @Headers("authorization") authorization: string | undefined, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.allowCustomerOnly(authorization, res);
    if (!session) return;
    const result = await this.forward("POST", "/api-rentals", session.sub, dto);
    await this.activity.record({
      session,
      action: "CREATE_API_RENTAL",
      targetType: "ApiRentalOrder",
      targetId: result.order_id,
      metadata: { app_name: dto.app_name, plan: dto.plan, duration: dto.duration, total: result.breakdown.total },
      req
    });
    return result;
  }

  private async forward(method: "GET" | "POST", path: string, userId: string, body?: unknown) {
    const base = process.env.RENTAL_SERVICE_URL ?? "http://localhost:3004";
    try {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(5000)
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new HttpException(payload ?? { error: "rental_service_error", message: "Rental service request failed" }, response.status);
      }
      return payload;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException({ error: "rental_service_unavailable", message: "Rental service is unavailable" });
    }
  }

  @Patch("api-keys/:id/scopes")
  async updateKeyScopes(@Param("id") id: string, @Body() dto: UpdateApiKeyScopesDto, @Headers("authorization") authorization: string | undefined, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.allowCustomerOnly(authorization, res);
    if (!session) return;
    const result = await this.platform.updateApiKeyScopes(id, session.sub, dto);
    await this.activity.record({
      session,
      action: "UPDATE_API_KEY_SCOPES",
      targetType: "ApiKey",
      targetId: id,
      metadata: { scopes: dto.scopes },
      req
    });
    return result;
  }

  private async allowCustomerOnly(authorization: string | undefined, res: Response) {
    const session = await this.auth.sessionFromAuthorization(authorization);
    if (!session) throw new UnauthorizedException("Login required");
    if (session.role === "ADMIN") {
      res.status(204).send();
      return null;
    }
    return session;
  }
}
