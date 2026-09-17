import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { RentalStatus } from "@prisma/client";
import { AuthService } from "../security/auth.service";
import { PrismaService } from "./prisma.service";
import { WebhookDeliveryService } from "./webhook-delivery.service";
import { NotificationDeliveryService } from "./notification-delivery.service";
import { SystemSettingsService } from "./system-settings.service";

@Injectable()
export class ApiMaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ApiMaintenanceService.name);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly prisma: PrismaService, private readonly webhooks: WebhookDeliveryService, private readonly auth: AuthService, private readonly notifications: NotificationDeliveryService, private readonly settings: SystemSettingsService) {}

  onModuleInit() {
    if (process.env.API_JOBS_DISABLED === "true") return;
    this.timer = setInterval(() => void this.tick().catch(error => this.logger.warn(error instanceof Error ? error.message : "API maintenance failed")), 15_000);
    void this.tick().catch(() => undefined);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now = new Date()) {
    const [webhooks, notifications, expired, quota, anomalies, rotation, samples, cleanup] = await Promise.all([
      this.webhooks.processDue(now),
      this.notifications.processDue(now),
      this.enqueueExpiredQr(now),
      this.enqueueQuotaWarnings(now),
      this.enqueueQuotaBurstWarnings(now),
      this.maintainRotatedKeys(now),
      this.sampleStatus(now),
      this.cleanupOldRows(now)
    ]);
    return { webhooks, notifications, expired, quota, anomalies, rotation, samples, cleanup };
  }

  private async enqueueExpiredQr(now: Date) {
    const expired = await this.prisma.externalQrCode.findMany({
      where: { expiresAt: { lte: now }, isUsed: false, expiryNotifiedAt: null, revokedAt: null, apiKey: { rentalId: { not: null } } },
      include: { apiKey: true },
      take: 100
    });
    for (const qr of expired) {
      await this.prisma.$transaction(async tx => {
        const updated = await tx.externalQrCode.updateMany({ where: { id: qr.id, expiryNotifiedAt: null }, data: { expiryNotifiedAt: now } });
        if (!updated.count) return;
        await this.webhooks.enqueue(tx, qr.apiKey.rentalId, "qr.expired", {
          qr_id: qr.id,
          ticket_code: qr.code,
          resource_type: qr.resourceType,
          resource_id: qr.resourceId,
          customer_ref: qr.customerRef,
          metadata: qr.metadata,
          is_test: qr.isTest,
          expired_at: qr.expiresAt.toISOString()
        }, `qr.expired:${qr.id}`);
      });
    }
    return expired.length;
  }

  private async enqueueQuotaWarnings(now: Date) {
    const month = now.toISOString().slice(0, 7);
    const rentals = await this.prisma.apiRentalOrder.findMany({ where: { status: RentalStatus.ACTIVE } });
    let count = 0;
    for (const rental of rentals) {
      const period = await this.prisma.apiUsagePeriod.findUnique({ where: { scopeId_month_isTest: { scopeId: rental.id, month, isTest: false } } });
      if (!period || rental.quota <= 0) continue;
      const ratio = period.qrCreated / rental.quota;
      const settings = await this.settings.apiPlatform();
      const configured = [...settings.quota_warning_thresholds].map(Number).filter(Number.isFinite).sort((a, b) => b - a);
      const threshold = configured.find(item => ratio >= item / 100) ?? 0;
      if (!threshold) continue;
      const dedupeKey = `quota:${rental.id}:${month}:${threshold}`;
      await this.prisma.apiNotification.upsert({
        where: { dedupeKey },
        update: {},
        create: {
          userId: rental.userId,
          rentalId: rental.id,
          dedupeKey,
          kind: "quota_warning",
          payload: { month, threshold, used: period.qrCreated, quota: rental.quota, app_name: rental.appName }
        }
      });
      count++;
    }
    return count;
  }

  private async enqueueQuotaBurstWarnings(now: Date) {
    const windowMinutes = Math.max(1, Number(process.env.API_QUOTA_BURST_WINDOW_MINUTES ?? 15));
    const thresholdPercent = Math.max(1, Number(process.env.API_QUOTA_BURST_PERCENT ?? 10));
    const since = new Date(now.getTime() - windowMinutes * 60 * 1000);
    const rentals = await this.prisma.apiRentalOrder.findMany({ where: { status: RentalStatus.ACTIVE } });
    let count = 0;
    for (const rental of rentals) {
      if (rental.quota <= 0) continue;
      const burst = await this.prisma.apiUsageEvent.aggregate({
        where: { rentalId: rental.id, action: "qr.create", success: true, isTest: false, createdAt: { gte: since } },
        _sum: { units: true }
      });
      const used = burst._sum.units ?? 0;
      if (used < rental.quota * thresholdPercent / 100) continue;
      const hour = now.toISOString().slice(0, 13);
      await this.prisma.apiNotification.upsert({
        where: { dedupeKey: `quota-burst:${rental.id}:${hour}` },
        update: {},
        create: {
          userId: rental.userId,
          rentalId: rental.id,
          dedupeKey: `quota-burst:${rental.id}:${hour}`,
          kind: "quota_burst_warning",
          payload: { window_minutes: windowMinutes, threshold_percent: thresholdPercent, used, quota: rental.quota, app_name: rental.appName }
        }
      });
      count++;
    }
    return count;
  }

  private async maintainRotatedKeys(now: Date) {
    const [revoked, resumed] = await Promise.all([
      this.prisma.apiKey.updateMany({ where: { status: "deprecated", revokeAt: { lte: now } }, data: { status: "revoked" } }),
      this.prisma.apiKey.updateMany({ where: { status: "suspended", suspendUntil: { lte: now } }, data: { status: "active", suspendUntil: null } })
    ]);
    const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const warningKeys = await this.prisma.apiKey.findMany({ where: { status: "deprecated", revokeAt: { lte: soon }, rotationWarnedAt: null } });
    for (const key of warningKeys) {
      await this.prisma.$transaction(async tx => {
        await tx.apiKey.updateMany({ where: { id: key.id, rotationWarnedAt: null }, data: { rotationWarnedAt: now } });
        await tx.apiNotification.upsert({
          where: { dedupeKey: `rotation:${key.id}` },
          update: {},
          create: {
            userId: key.userId,
            rentalId: key.rentalId,
            dedupeKey: `rotation:${key.id}`,
            kind: "key_rotation_warning",
            payload: { key_prefix: key.prefix, revoke_at: key.revokeAt?.toISOString() ?? null }
          }
        });
      });
    }
    return revoked.count + resumed.count + warningKeys.length;
  }

  private async cleanupOldRows(now: Date) {
    const logRetentionDays = Math.max(1, Number(process.env.API_REQUEST_LOG_RETENTION_DAYS ?? 90));
    const logCutoff = new Date(now.getTime() - logRetentionDays * 24 * 60 * 60 * 1000);
    const idempotencyCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const [idempotency, logs] = await Promise.all([
      this.prisma.apiIdempotency.deleteMany({ where: { expiresAt: { lte: idempotencyCutoff } } }),
      this.prisma.apiRequestLog.deleteMany({ where: { createdAt: { lt: logCutoff } } })
    ]);
    return { idempotency: idempotency.count, requestLogs: logs.count, logRetentionDays };
  }

  private async sampleStatus(now: Date) {
    const started = Date.now();
    let healthy = true;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      healthy = false;
    }
    await this.prisma.apiStatusSample.create({ data: { healthy, latencyMs: Date.now() - started, createdAt: now } });
    return 1;
  }
}
