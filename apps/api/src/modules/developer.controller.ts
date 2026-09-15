import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req, Res, UnauthorizedException } from "@nestjs/common";
import { Request, Response } from "express";
import { DeveloperAnalyticsQueryDto, DeveloperAuditQueryDto, DeveloperCreateKeyDto, DeveloperPlanDto, DeveloperRentalSettingsDto, DeveloperRotateKeyDto, DeveloperSecretDto, DeveloperUpdateKeyDto } from "../developer.dto";
import { AuthService } from "../security/auth.service";
import { ActivityLogService } from "../services/activity-log.service";
import { DeveloperService } from "../services/developer.service";

@Controller("api/v1/developer")
export class DeveloperController {
  constructor(private readonly developer: DeveloperService, private readonly auth: AuthService, private readonly activity: ActivityLogService) {}

  @Get("overview")
  async overview(@Headers("authorization") authorization: string | undefined, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.session(authorization, res);
    if (!session) return;
    const result = await this.developer.overview(session.sub);
    await this.activity.record({ session, action: "VIEW_DEVELOPER_OVERVIEW", targetType: "Developer", metadata: { keys: result.keys.length }, req });
    return result;
  }

  @Patch("keys/:id")
  async updateKey(@Param("id") id: string, @Body() dto: DeveloperUpdateKeyDto, @Headers("authorization") authorization: string | undefined, @Res({ passthrough: true }) res: Response) {
    const session = await this.session(authorization, res);
    return session ? this.developer.updateKey(session, id, dto) : undefined;
  }

  @Post("keys/:id/rotate")
  async rotate(@Param("id") id: string, @Body() dto: DeveloperRotateKeyDto, @Headers("authorization") authorization: string | undefined, @Res({ passthrough: true }) res: Response) {
    const session = await this.session(authorization, res);
    return session ? this.developer.rotate(session, id, dto.password) : undefined;
  }

  @Post("keys/:id/revoke")
  async revoke(@Param("id") id: string, @Headers("authorization") authorization: string | undefined, @Res({ passthrough: true }) res: Response) {
    const session = await this.session(authorization, res);
    return session ? this.developer.revoke(session, id) : undefined;
  }

  @Post("rentals/:id/test-key")
  async testKey(@Param("id") id: string, @Headers("authorization") authorization: string | undefined, @Res({ passthrough: true }) res: Response) {
    const session = await this.session(authorization, res);
    return session ? this.developer.createTestKey(session, id) : undefined;
  }

  @Post("rentals/:id/keys")
  async createKey(@Param("id") id: string, @Body() dto: DeveloperCreateKeyDto, @Headers("authorization") authorization: string | undefined, @Res({ passthrough: true }) res: Response) {
    const session = await this.session(authorization, res);
    return session ? this.developer.createKey(session, id, dto.scopes) : undefined;
  }

  @Patch("rentals/:id/settings")
  async settings(@Param("id") id: string, @Body() dto: DeveloperRentalSettingsDto, @Headers("authorization") authorization: string | undefined, @Res({ passthrough: true }) res: Response) {
    const session = await this.session(authorization, res);
    return session ? this.developer.updateSettings(session, id, dto) : undefined;
  }

  @Post("rentals/:id/secrets")
  async secret(@Param("id") id: string, @Body() dto: DeveloperSecretDto, @Headers("authorization") authorization: string | undefined, @Res({ passthrough: true }) res: Response) {
    const session = await this.session(authorization, res);
    return session ? this.developer.rotateSecret(session, id, dto.kind, dto.password) : undefined;
  }

  @Post("rentals/:id/secrets/reveal")
  async secrets(@Param("id") id: string, @Body() dto: { password?: string }, @Headers("authorization") authorization: string | undefined, @Res({ passthrough: true }) res: Response) {
    const session = await this.session(authorization, res);
    return session ? this.developer.revealSecrets(session, id, dto.password) : undefined;
  }

  @Patch("rentals/:id/plan")
  async plan(@Param("id") id: string, @Body() dto: DeveloperPlanDto, @Headers("authorization") authorization: string | undefined, @Res({ passthrough: true }) res: Response) {
    const session = await this.session(authorization, res);
    return session ? this.developer.changePlan(session, id, dto) : undefined;
  }

  @Get("analytics")
  async analytics(@Query() query: DeveloperAnalyticsQueryDto, @Headers("authorization") authorization: string | undefined, @Res({ passthrough: true }) res: Response) {
    const session = await this.session(authorization, res);
    return session ? this.developer.analytics(session.sub, query) : undefined;
  }

  @Get("audit")
  async audit(@Query() query: DeveloperAuditQueryDto, @Headers("authorization") authorization: string | undefined, @Res({ passthrough: true }) res: Response) {
    const session = await this.session(authorization, res);
    return session ? this.developer.audit(session.sub, query) : undefined;
  }

  @Get("audit/export")
  async auditExport(@Query() query: DeveloperAuditQueryDto, @Headers("authorization") authorization: string | undefined, @Res() res: Response) {
    const session = await this.session(authorization, res);
    if (!session) return;
    const csv = await this.developer.auditCsv(session.sub, query);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=smartqr-audit.csv");
    return res.send(csv);
  }

  @Get("webhooks")
  async webhooks(@Query("page") page: string | undefined, @Headers("authorization") authorization: string | undefined, @Res({ passthrough: true }) res: Response) {
    const session = await this.session(authorization, res);
    return session ? this.developer.webhooks(session.sub, Math.max(1, Number(page || 1))) : undefined;
  }

  @Post("webhooks/:id/retry")
  async retryWebhook(@Param("id") id: string, @Headers("authorization") authorization: string | undefined, @Res({ passthrough: true }) res: Response) {
    const session = await this.session(authorization, res);
    return session ? this.developer.retryWebhook(session, id) : undefined;
  }

  private async session(authorization: string | undefined, res: Response) {
    const session = await this.auth.sessionFromAuthorization(authorization);
    if (!session) throw new UnauthorizedException("Login required");
    if (session.role === "ADMIN") {
      res.status(204).send();
      return null;
    }
    return session;
  }
}


