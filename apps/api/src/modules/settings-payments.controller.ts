import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import { AdminApiPlatformSettingsDto, AdminIncidentDto, PaymentCreateDto, PaymentQueryDto, PaymentStatusDto } from "../settings-payment.dto";
import { RequireApiKey } from "../security/api-key.decorator";
import { AuthService } from "../security/auth.service";
import { AccountSettingsService } from "../services/account-settings.service";
import { ActivityLogService } from "../services/activity-log.service";
import { PaymentTransactionsService } from "../services/payment-transactions.service";
import { PrismaService } from "../services/prisma.service";
import { SystemSettingsService } from "../services/system-settings.service";

@Controller("api/v1/payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentTransactionsService) {}

  @Post()
  @RequireApiKey("ticket:verify")
  create(@Body() dto: PaymentCreateDto, @Headers("x-api-key") apiKey?: string, @Headers("idempotency-key") idempotencyKey?: string) {
    return this.payments.create(dto, apiKey, idempotencyKey);
  }
}

@Controller("api/v1/developer/payments")
export class DeveloperPaymentsController {
  constructor(private readonly payments: PaymentTransactionsService, private readonly auth: AuthService) {}

  @Get()
  async list(@Query() query: PaymentQueryDto, @Headers("authorization") authorization?: string) {
    const session = await this.session(authorization);
    return this.payments.developerPayments(session.sub, query);
  }

  private async session(authorization?: string) {
    const session = await this.auth.sessionFromAuthorization(authorization);
    if (!session) throw new UnauthorizedException({ error: "unauthorized", message: "Login required" });
    return session;
  }
}

@Controller("api/v1/admin")
export class AdminSettingsPaymentsController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly settings: SystemSettingsService,
    private readonly payments: PaymentTransactionsService,
    private readonly account: AccountSettingsService,
    private readonly activity: ActivityLogService
  ) {}

  @Get("settings")
  async getSettings(@Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    return { api_platform: await this.settings.apiPlatform() };
  }

  @Patch("settings")
  async updateSettings(@Body() dto: AdminApiPlatformSettingsDto, @Headers("authorization") authorization: string | undefined, @Req() req: Request) {
    const session = await this.assertAdmin(authorization);
    const result = await this.settings.updateApiPlatform(dto, session.sub);
    await this.activity.record({ session, action: "UPDATE_SYSTEM_SETTINGS", targetType: "SystemSetting", targetId: "api_platform", metadata: result as never, req });
    if (JSON.stringify(result.before.quota_burst) !== JSON.stringify(result.after.quota_burst)) {
      await this.activity.record({
        session,
        action: "UPDATE_QUOTA_BURST_SETTINGS",
        targetType: "SystemSetting",
        targetId: "api_platform",
        metadata: { before: result.before.quota_burst, after: result.after.quota_burst },
        req
      });
    }
    return { api_platform: result.after, version: result.version };
  }

  @Get("users")
  async users(@Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    return this.prisma.user.findMany({
      select: {
        id: true, email: true, role: true, avatarUrl: true, createdAt: true,
        apiRentals: { select: { id: true, appName: true, status: true, plan: true } },
        payoutAccounts: { where: { status: { not: "deleted" } }, select: { id: true, method: true, bankName: true, accountNumber: true, accountName: true, walletType: true, walletId: true, isDefault: true, status: true, userId: true, branch: true, createdAt: true, updatedAt: true } }
      },
      orderBy: { createdAt: "desc" }, take: 200
    }).then(users => users.map(user => ({ ...user, payoutAccounts: user.payoutAccounts.map(account => this.account.maskAccount(account)) })));
  }

  @Post("payout-accounts/:id/reveal")
  async revealPayout(@Param("id") id: string, @Headers("authorization") authorization?: string) {
    const session = await this.assertAdmin(authorization);
    return this.account.revealPayoutAccount(session, id);
  }


  @Get("incidents")
  async incidents(@Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    const items = await this.prisma.apiIncident.findMany({ orderBy: { startedAt: "desc" }, take: 100 });
    return { items: items.map(item => this.publicIncident(item)) };
  }

  @Post("incidents")
  async createIncident(@Body() dto: AdminIncidentDto, @Headers("authorization") authorization: string | undefined, @Req() req: Request) {
    const session = await this.assertAdmin(authorization);
    const incident = await this.prisma.apiIncident.create({
      data: {
        title: dto.title.trim(),
        status: dto.status,
        startedAt: dto.started_at ? new Date(dto.started_at) : new Date(),
        resolvedAt: dto.resolved_at ? new Date(dto.resolved_at) : dto.status === "resolved" ? new Date() : null
      }
    });
    await this.activity.record({ session, action: "CREATE_API_INCIDENT", targetType: "ApiIncident", targetId: incident.id, metadata: this.publicIncident(incident) as never, req });
    return { incident: this.publicIncident(incident) };
  }

  @Patch("incidents/:id")
  async updateIncident(@Param("id") id: string, @Body() dto: Partial<AdminIncidentDto>, @Headers("authorization") authorization: string | undefined, @Req() req: Request) {
    const session = await this.assertAdmin(authorization);
    const incident = await this.prisma.apiIncident.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        status: dto.status,
        startedAt: dto.started_at ? new Date(dto.started_at) : undefined,
        resolvedAt: dto.resolved_at ? new Date(dto.resolved_at) : dto.status === "resolved" ? new Date() : dto.status ? null : undefined
      }
    });
    await this.activity.record({ session, action: "UPDATE_API_INCIDENT", targetType: "ApiIncident", targetId: incident.id, metadata: this.publicIncident(incident) as never, req });
    return { incident: this.publicIncident(incident) };
  }

  @Get("payments")
  async adminPayments(@Query() query: PaymentQueryDto, @Headers("authorization") authorization?: string) {
    await this.assertAdmin(authorization);
    return this.payments.adminPayments(query);
  }

  @Patch("payments/:id/status")
  async updatePayment(@Param("id") id: string, @Body() dto: PaymentStatusDto, @Headers("authorization") authorization?: string) {
    const session = await this.assertAdmin(authorization);
    return this.payments.updateStatus(session, id, dto);
  }

  private publicIncident(item: { id: string; title: string; status: string; startedAt: Date; resolvedAt: Date | null }) {
    return { id: item.id, title: item.title, status: item.status, started_at: item.startedAt.toISOString(), resolved_at: item.resolvedAt?.toISOString() ?? null };
  }

  private async assertAdmin(authorization?: string) {
    const session = await this.auth.sessionFromAuthorization(authorization);
    if (!session) throw new UnauthorizedException({ error: "unauthorized", message: "Login required" });
    if (session.role !== "ADMIN") throw new UnauthorizedException({ error: "admin_required", message: "Admin role required" });
    return session;
  }
}
