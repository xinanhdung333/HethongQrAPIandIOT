import { BadRequestException, Body, Controller, Get, Headers, Post, Query, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../security/auth.service";
import { RequireApiKey } from "../security/api-key.decorator";
import { enableOfflineCapable, isOfflineCapable, resolveTenantId } from "../security/tenant";
import { GateSyncService } from "../services/gate-sync.service";
import { PrismaService } from "../services/prisma.service";

type UsageEventBody = {
  events: {
    jti: string;
    gate_id: string;
    used_at: string;
    resource_type: "external_qr" | "ticket";
  }[];
};

@Controller("api/v1/gates")
export class GatesController {
  constructor(private readonly gates: GateSyncService, private readonly auth: AuthService, private readonly prisma: PrismaService) {}

  @Get("public-key")
  @RequireApiKey("ticket:verify")
  async publicKey(@Headers("x-api-key") raw: string) {
    const key = await this.requireKey(raw);
    return this.gates.publicKeyForTenant(resolveTenantId(key));
  }

  @Post("tenant-settings/enable-offline")
  @RequireApiKey("qr:create")
  async enableOffline(@Headers("x-api-key") raw: string) {
    const key = await this.requireKey(raw);
    const tenantId = resolveTenantId(key);
    await enableOfflineCapable(this.prisma, tenantId, key.userId);
    const settings = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });
    return { tenant_id: tenantId, offline_capable: true, enabled_at: settings?.enabledAt ?? null };
  }

  @Get("tenant-settings")
  @RequireApiKey("qr:create")
  async tenantSettings(@Headers("x-api-key") raw: string) {
    const key = await this.requireKey(raw);
    const tenantId = resolveTenantId(key);
    const settings = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });
    return { tenant_id: tenantId, offline_capable: settings?.offlineCapable ?? false, enabled_at: settings?.enabledAt ?? null };
  }

  @Get("session-public-key")
  async sessionPublicKey(@Headers("authorization") authorization?: string) {
    const session = await this.auth.sessionFromAuthorization(authorization);
    if (!session) throw new UnauthorizedException({ error: "unauthorized", message: "Login required" });
    if (!(await isOfflineCapable(this.prisma, session.sub))) {
      throw new BadRequestException({ error: "tenant_offline_disabled", message: "Tenant nay chua bat che do quet offline" });
    }
    return this.gates.publicKeyForTenant(session.sub);
  }

  @Get("revoked-delta")
  @RequireApiKey("ticket:verify")
  async revokedDelta(@Headers("x-api-key") raw: string, @Query("since") since?: string) {
    const key = await this.requireKey(raw);
    const sinceDate = since ? new Date(since) : new Date(0);
    if (Number.isNaN(sinceDate.getTime())) throw new BadRequestException({ error: "invalid_since", message: "since must be an ISO date" });
    return this.gates.revokedDelta(key, sinceDate);
  }

  @Post("usage-events")
  @RequireApiKey("ticket:verify")
  async usageEvents(@Headers("x-api-key") raw: string, @Body() body: UsageEventBody) {
    const key = await this.requireKey(raw);
    if (!Array.isArray(body.events) || body.events.length === 0 || body.events.length > 500) {
      throw new BadRequestException({ error: "invalid_events", message: "events must contain 1-500 items" });
    }
    const invalid = body.events.some((event) =>
      !event?.jti ||
      !event.gate_id ||
      !event.used_at ||
      (event.resource_type !== "external_qr" && event.resource_type !== "ticket")
    );
    if (invalid) {
      throw new BadRequestException({ error: "invalid_events", message: "each event must include jti, gate_id, used_at, and resource_type" });
    }
    return this.gates.reportUsageEvents(key, body.events);
  }

  @Get("conflicts")
  @RequireApiKey("ticket:verify")
  async conflicts(@Headers("x-api-key") raw: string) {
    const key = await this.requireKey(raw);
    return this.gates.listConflicts(key);
  }

  private async requireKey(raw: string) {
    const key = await this.auth.getApiKey(raw);
    if (!key) throw new UnauthorizedException({ error: "invalid_api_key", message: "Invalid or expired API key" });
    return key;
  }
}
