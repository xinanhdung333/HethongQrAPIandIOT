import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, RentalStatus } from "@prisma/client";
import { AuthService, FULL_API_KEY_SCOPES } from "../security/auth.service";
import { generateSecret, openSecret, sealSecret } from "../security/secret-box";
import { ApiKeyIssuanceService } from "./api-key-issuance.service";
import { parseCallbackUrl } from "./safe-http";
import { PrismaService } from "./prisma.service";
import { SystemSettingsService } from "./system-settings.service";
import { ActivityLogService } from "./activity-log.service";
import { Request } from "express";

const PLAN_QUOTAS = { starter: 5000, business: 30000 } as const;
const PLAN_PRICES = { starter: 199000, business: 499000 } as const;
const PLAN_RATE_LIMITS = { starter: 60, business: 600 } as const;
const DEFAULT_SHOW_KEY_GRACE_MINUTES = 60;

type Session = { sub: string; role: string };

function safeSecurityMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return Object.fromEntries(["showId", "replacementKeyId", "graceMinutes", "kind", "until"].flatMap((key) =>
    key in record ? [[key, record[key]]] : []
  ));
}

@Injectable()
export class DeveloperService {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService, private readonly settings: SystemSettingsService, private readonly keys: ApiKeyIssuanceService, private readonly activity: ActivityLogService) {}

  async overview(userId: string) {
    const [keys, rentals, notifications] = await Promise.all([
      this.prisma.apiKey.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
      this.prisma.apiRentalOrder.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
      this.prisma.apiNotification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 })
    ]);
    return {
      keys: keys.map(key => this.publicKey(key)),
      rentals: rentals.map(rental => this.publicRental(rental)),
      notifications
    };
  }

  async updateKey(session: Session, id: string, dto: { scopes?: string[]; allowed_ips?: string[]; rate_limit?: number }) {
    const key = await this.keyForUser(session, id);
    const data: Prisma.ApiKeyUpdateInput = {};
    if (dto.scopes) {
      if (!dto.scopes.length) throw new BadRequestException({ error: "invalid_scopes", message: "API key must have at least one scope" });
      data.scopes = Array.from(new Set(dto.scopes.filter(scope => FULL_API_KEY_SCOPES.includes(scope as never))));
    }
    if (dto.allowed_ips) data.allowedIps = Array.from(new Set(dto.allowed_ips.map(ip => ip.trim()).filter(Boolean)));
    if (dto.rate_limit) data.rateLimit = dto.rate_limit;
    const updated = await this.prisma.apiKey.update({ where: { id: key.id }, data });
    return { key: this.publicKey(updated) };
  }

  async rotate(session: Session, id: string, password?: string, graceMinutes = DEFAULT_SHOW_KEY_GRACE_MINUTES, req?: Request) {
    await this.requirePassword(session.sub, password);
    const old = await this.keyForUser(session, id);
    if (!old.rentalId && !old.showId) throw new BadRequestException({ error: "missing_scope_owner", message: "This key is not attached to a rental or show" });
    if (!Number.isInteger(graceMinutes) || graceMinutes < 1 || graceMinutes > 1440) {
      throw new BadRequestException({ error: "invalid_grace_minutes", message: "grace_minutes must be an integer between 1 and 1440" });
    }
    const isShowKey = Boolean(old.showId);
    const revokeAt = new Date(Date.now() + (isShowKey ? graceMinutes * 60 * 1000 : 7 * 24 * 60 * 60 * 1000));
    const issued = await this.prisma.$transaction(async tx => {
      await tx.apiKey.update({ where: { id: old.id }, data: { status: "deprecated", revokeAt } });
      return this.keys.issueKey({
        userId: old.userId,
        ...(old.rentalId ? { rentalId: old.rentalId } : { showId: old.showId! }),
        scopes: (Array.isArray(old.scopes) ? old.scopes : FULL_API_KEY_SCOPES) as never[],
        quota: old.quota,
        mode: old.isTest ? "test" : "live",
        source: "developer",
        excludeKeyId: old.id,
        tx
      });
    });
    await this.activity.record({
      session,
      action: isShowKey ? "ROTATE_SHOW_SCAN_KEY" : "ROTATE_API_KEY",
      targetType: "ApiKey",
      targetId: old.id,
      metadata: { ...(isShowKey ? { showId: old.showId, graceMinutes } : {}), replacementKeyId: issued.key.id },
      req
    });
    return { api_key_once: issued.api_key_once, key: this.publicKey(issued.key), old_revoke_at: revokeAt.toISOString() };
  }

  async revoke(session: Session, id: string, req?: Request) {
    const key = await this.keyForUser(session, id);
    const updated = await this.prisma.apiKey.update({ where: { id: key.id }, data: { status: "revoked", revokeAt: new Date() } });
    await this.activity.record({ session, action: "REVOKE_API_KEY", targetType: "ApiKey", targetId: key.id, req });
    return { key: this.publicKey(updated) };
  }

  async suspend(session: Session, id: string, until?: string, req?: Request) {
    const key = await this.keyForUser(session, id);
    const suspendedUntil = until ? new Date(until) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (Number.isNaN(suspendedUntil.getTime()) || suspendedUntil <= new Date()) {
      throw new BadRequestException({ error: "invalid_suspend_until", message: "until must be a future ISO date" });
    }

    const updated = await this.prisma.apiKey.update({ where: { id: key.id }, data: { status: "suspended", suspendUntil: suspendedUntil } });
    await this.activity.record({ session, action: "SUSPEND_API_KEY", targetType: "ApiKey", targetId: key.id, metadata: { until: suspendedUntil.toISOString() }, req });
    return { key: this.publicKey(updated) };
  }

  async resume(session: Session, id: string, req?: Request) {
    const key = await this.keyForUser(session, id);
    const updated = await this.prisma.apiKey.update({ where: { id: key.id }, data: { status: "active", suspendUntil: null } });
    await this.activity.record({ session, action: "RESUME_API_KEY", targetType: "ApiKey", targetId: key.id, req });
    return { key: this.publicKey(updated) };
  }

  async createTestKey(session: Session, rentalId: string) {
    const rental = await this.rentalForUser(session, rentalId);
    if (rental.status !== RentalStatus.ACTIVE) throw new ForbiddenException({ error: "rental_inactive", message: "API rental is not active" });
    const issued = await this.keys.issueKey({ userId: rental.userId, rentalId: rental.id, scopes: (Array.isArray(rental.scopes) ? rental.scopes : FULL_API_KEY_SCOPES) as never[], mode: "test", source: "developer" });
    return { api_key_once: issued.api_key_once, key: this.publicKey(issued.key) };
  }

  async createKey(session: Session, rentalId: string, scopes: string[]) {
    const rental = await this.rentalForUser(session, rentalId);
    if (rental.status !== RentalStatus.ACTIVE) throw new ForbiddenException({ error: "rental_inactive", message: "API rental is not active" });
    const selectedScopes = Array.from(new Set(scopes.filter(scope => FULL_API_KEY_SCOPES.includes(scope as never))));
    if (!selectedScopes.length) throw new BadRequestException({ error: "invalid_scopes", message: "API key must have at least one scope" });
    const issued = await this.keys.issueKey({ userId: rental.userId, rentalId: rental.id, scopes: selectedScopes as never[], mode: "live", source: "developer" });
    return { api_key_once: issued.api_key_once, key: this.publicKey(issued.key) };
  }

  async updateSettings(session: Session, rentalId: string, dto: { signing_enabled?: boolean; callback_url?: string }) {
    const rental = await this.rentalForUser(session, rentalId);
    const data: Prisma.ApiRentalOrderUpdateInput = {};
    if (dto.signing_enabled !== undefined) {
      data.signingEnabled = dto.signing_enabled;
      if (dto.signing_enabled && !rental.signingSecret) data.signingSecret = sealSecret(generateSecret("sigsec_"));
    }
    if (dto.callback_url !== undefined) {
      const value = dto.callback_url.trim();
      if (value) {
        try { parseCallbackUrl(value); }
        catch (error) { throw new BadRequestException({ error: "invalid_callback_url", message: error instanceof Error ? error.message : "Invalid callback URL" }); }
      }
      data.callbackUrl = value || null;
      if (value && !rental.webhookSecret) data.webhookSecret = sealSecret(generateSecret("whsec_"));
    }
    const updated = await this.prisma.apiRentalOrder.update({ where: { id: rental.id }, data });
    return { rental: this.publicRental(updated) };
  }

  async rotateSecret(session: Session, rentalId: string, kind: "signing" | "webhook", password?: string, req?: Request) {
    await this.requirePassword(session.sub, password);
    const rental = await this.rentalForUser(session, rentalId);
    const secret = generateSecret(kind === "signing" ? "sigsec_" : "whsec_");
    const updated = await this.prisma.apiRentalOrder.update({
      where: { id: rental.id },
      data: kind === "signing" ? { signingSecret: sealSecret(secret), signingEnabled: true } : { webhookSecret: sealSecret(secret) }
    });
    await this.activity.record({ session, action: "ROTATE_RENTAL_SECRET", targetType: "ApiRentalOrder", targetId: rental.id, metadata: { kind }, req });
    return { secret_once: secret, rental: this.publicRental(updated) };
  }

  async revealSecrets(session: Session, rentalId: string, password?: string, req?: Request) {
    await this.requirePassword(session.sub, password);
    const rental = await this.rentalForUser(session, rentalId);
    await this.activity.record({ session, action: "REVEAL_RENTAL_SECRETS", targetType: "ApiRentalOrder", targetId: rental.id, req });
    return {
      signing_secret: rental.signingSecret ? openSecret(rental.signingSecret) : null,
      webhook_secret: rental.webhookSecret ? openSecret(rental.webhookSecret) : null
    };
  }

  async changePlan(session: Session, rentalId: string, dto: { plan: "starter" | "business"; billing_mode: "fixed" | "payg" }) {
    const rental = await this.rentalForUser(session, rentalId);
    const plan = (await this.settings.apiPlatform()).plan_limits[dto.plan];
    const quota = plan?.quota ?? PLAN_QUOTAS[dto.plan];
    const total = (plan?.price ?? PLAN_PRICES[dto.plan]) * rental.duration;
    const updated = await this.prisma.$transaction(async tx => {
      await tx.apiKey.updateMany({ where: { rentalId: rental.id }, data: { quota, rateLimit: plan?.rate_limit ?? PLAN_RATE_LIMITS[dto.plan] } });
      return tx.apiRentalOrder.update({ where: { id: rental.id }, data: { plan: dto.plan, billingMode: dto.billing_mode, quota, total } });
    });
    return { rental: this.publicRental(updated) };
  }

  async analytics(userId: string, query: { month?: string; key_id?: string; is_test?: string }) {
    const month = query.month && /^\d{4}-\d{2}$/.test(query.month) ? query.month : new Date().toISOString().slice(0, 7);
    const isTest = query.is_test === "true";
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    const where: Prisma.ApiUsageEventWhereInput = { userId, isTest, createdAt: { gte: start, lt: end }, ...(query.key_id ? { apiKeyId: query.key_id } : {}) };
    const [events, periods] = await Promise.all([
      this.prisma.apiUsageEvent.findMany({ where, orderBy: { createdAt: "asc" } }),
      this.prisma.apiUsagePeriod.findMany({ where: { month, isTest } })
    ]);
    const daily = new Map<string, { date: string; requests: number; qr_created: number; verify_success: number; verify_failed: number; cost: number }>();
    const resourceTypes = new Map<string, number>();
    let billed = 0;
    let qrCreated = 0;
    let verifySuccess = 0;
    let verifyFailed = 0;
    for (const event of events) {
      const date = event.createdAt.toISOString().slice(0, 10);
      const row = daily.get(date) ?? { date, requests: 0, qr_created: 0, verify_success: 0, verify_failed: 0, cost: 0 };
      row.requests += 1;
      row.cost += event.cost;
      billed += event.cost;
      if (event.action === "qr.create") { row.qr_created += event.units; qrCreated += event.units; }
      if (event.action === "qr.verify" && event.success) { row.verify_success += 1; verifySuccess += 1; }
      if (event.action === "qr.verify" && !event.success) { row.verify_failed += 1; verifyFailed += 1; }
      if (event.resourceType) resourceTypes.set(event.resourceType, (resourceTypes.get(event.resourceType) ?? 0) + event.units);
      daily.set(date, row);
    }
    return {
      month,
      is_test: isTest,
      totals: { requests: events.length, qr_created: qrCreated, verify_success: verifySuccess, verify_failed: verifyFailed, billed_amount: billed },
      daily: Array.from(daily.values()),
      resource_types: Array.from(resourceTypes, ([resource_type, count]) => ({ resource_type, count })).sort((a, b) => b.count - a.count),
      usage: periods.map(period => ({ scope_id: period.scopeId, quota: 0, qr_created: period.qrCreated, billed_amount: period.billedAmount }))
    };
  }

  async audit(userId: string, query: { from?: string; to?: string; endpoint?: string; status?: string; page?: string; is_test?: string }) {
    const page = Math.max(1, Number(query.page || 1));
    const where: Prisma.ApiRequestLogWhereInput = { userId };
    if (query.is_test) where.isTest = query.is_test === "true";
    if (query.endpoint) where.endpoint = { contains: query.endpoint };
    if (query.status) where.statusCode = Number(query.status);
    if (query.from || query.to) where.createdAt = { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.apiRequestLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50 }),
      this.prisma.apiRequestLog.count({ where })
    ]);
    return { items, total, page };
  }

  async securityEvents(userId: string, query: { from?: string; to?: string; action?: string; page?: string }) {
    const actions = ["ROTATE_API_KEY", "ROTATE_SHOW_SCAN_KEY", "REVOKE_API_KEY", "SUSPEND_API_KEY", "RESUME_API_KEY", "ROTATE_RENTAL_SECRET", "REVEAL_RENTAL_SECRETS"];
    const page = Math.max(1, Number(query.page || 1));
    const where: Prisma.ActivityLogWhereInput = { userId, action: query.action && actions.includes(query.action) ? query.action : { in: actions } };
    if (query.from || query.to) where.createdAt = {
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to ? { lte: new Date(query.to) } : {})
    };
    const [items, total] = await Promise.all([
      this.prisma.activityLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50 }),
      this.prisma.activityLog.count({ where })
    ]);
    return {
      items: items.map((item) => ({
        id: item.id,
        action: item.action,
        targetType: item.targetType,
        targetId: item.targetId,
        ip: item.ip,
        userAgent: item.userAgent,
        createdAt: item.createdAt,
        metadata: safeSecurityMetadata(item.metadata)
      })),
      total,
      page
    };
  }

  async auditCsv(userId: string, query: { from?: string; to?: string; endpoint?: string; status?: string; is_test?: string }) {
    const where: Prisma.ApiRequestLogWhereInput = { userId };
    if (query.is_test) where.isTest = query.is_test === "true";
    if (query.endpoint) where.endpoint = { contains: query.endpoint };
    if (query.status) where.statusCode = Number(query.status);
    if (query.from || query.to) where.createdAt = { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) };
    const rows = await this.prisma.apiRequestLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 10000 });
    const esc = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    return ["created_at,method,endpoint,status_code,duration_ms,ip,error,is_test", ...rows.map(row => [row.createdAt.toISOString(), row.method, row.endpoint, row.statusCode, row.durationMs, row.ip, row.error, row.isTest].map(esc).join(","))].join("\n");
  }

  async webhooks(userId: string, page = 1) {
    const rentals = await this.prisma.apiRentalOrder.findMany({ where: { userId }, select: { id: true } });
    const rentalIds = rentals.map(item => item.id);
    const where: Prisma.WebhookEventWhereInput = { rentalId: { in: rentalIds } };
    const [items, total] = await Promise.all([
      this.prisma.webhookEvent.findMany({ where, include: { logs: { orderBy: { createdAt: "desc" } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50 }),
      this.prisma.webhookEvent.count({ where })
    ]);
    return { items, total, page };
  }

  async retryWebhook(session: Session, id: string) {
    const event = await this.prisma.webhookEvent.findUnique({ where: { id } });
    if (!event) throw new NotFoundException({ error: "webhook_not_found", message: "Webhook event not found" });
    await this.rentalForUser(session, event.rentalId);
    if (event.manualReplayCount >= 5) throw new ForbiddenException({ error: "manual_replay_limit", message: "Webhook event reached the 5 manual replay limit" });
    const updated = await this.prisma.webhookEvent.update({ where: { id }, data: { status: "pending", lockedUntil: null, nextAttemptAt: new Date(), manualReplayCount: { increment: 1 } } });
    return { item: updated };
  }

  publicKey(key: { id: string; prefix: string; quota: number; scopes: unknown; rentalId: string | null; status: string; isTest: boolean; allowedIps: unknown; rateLimit: number; revokeAt: Date | null; suspendUntil?: Date | null; createdAt: Date }) {
    return {
      id: key.id,
      prefix: key.prefix,
      quota: key.quota,
      scopes: Array.isArray(key.scopes) ? key.scopes : FULL_API_KEY_SCOPES,
      rentalId: key.rentalId,
      status: key.status,
      isTest: key.isTest,
      allowedIps: Array.isArray(key.allowedIps) ? key.allowedIps : [],
      rateLimit: key.rateLimit,
      revokeAt: key.revokeAt,
      suspendUntil: key.suspendUntil ?? null,
      createdAt: key.createdAt
    };
  }

  publicRental(rental: { id: string; appName: string; website: string | null; callbackUrl: string | null; plan: string; duration: number; quota: number; scopes: unknown; total: number; status: RentalStatus; apiKeyPrefix: string | null; signingEnabled: boolean; billingMode: string; createUnitPrice: number; verifyUnitPrice: number; createdAt: Date; updatedAt: Date }) {
    return {
      id: rental.id,
      appName: rental.appName,
      website: rental.website,
      callbackUrl: rental.callbackUrl,
      plan: rental.plan,
      duration: rental.duration,
      quota: rental.quota,
      scopes: Array.isArray(rental.scopes) ? rental.scopes : FULL_API_KEY_SCOPES,
      total: rental.total,
      status: rental.status,
      apiKeyPrefix: rental.apiKeyPrefix,
      signingEnabled: rental.signingEnabled,
      billingMode: rental.billingMode,
      createUnitPrice: rental.createUnitPrice,
      verifyUnitPrice: rental.verifyUnitPrice,
      allowedScopes: FULL_API_KEY_SCOPES,
      createdAt: rental.createdAt,
      updatedAt: rental.updatedAt
    };
  }

  private async keyForUser(session: Session, id: string) {
    const key = await this.prisma.apiKey.findFirst({ where: { id, userId: session.sub }, include: { rental: true } });
    if (!key) throw new NotFoundException({ error: "api_key_not_found", message: "API key not found" });
    return key;
  }

  private async assertKeyLimit(rentalId: string | null, planName?: string | null, tx: Prisma.TransactionClient | PrismaService = this.prisma, excludeKeyId?: string) {
    if (!rentalId) return;
    const settings = await this.settings.apiPlatform();
    const plan = settings.plan_limits[(planName || "starter") as "starter" | "business"] ?? settings.plan_limits.starter;
    const count = await tx.apiKey.count({ where: { rentalId, status: { in: ["active", "deprecated"] }, ...(excludeKeyId ? { id: { not: excludeKeyId } } : {}) } });
    if (count >= plan.max_keys) throw new ForbiddenException({ error: "api_key_limit_exceeded", message: `Plan allows at most ${plan.max_keys} active/deprecated API keys for this rental` });
  }

  private async requirePassword(userId: string, password?: string) {
    if (!password) throw new ForbiddenException({ error: "reauth_required", message: "Password is required to reveal or rotate sensitive data" });
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!user || !(await this.auth.comparePassword(password, user.passwordHash))) throw new ForbiddenException({ error: "reauth_failed", message: "Password is invalid" });
  }

  private async rentalForUser(session: Session, id: string) {
    const rental = await this.prisma.apiRentalOrder.findFirst({ where: { id, userId: session.sub } });
    if (!rental) throw new NotFoundException({ error: "api_rental_not_found", message: "API rental not found" });
    return rental;
  }
}
