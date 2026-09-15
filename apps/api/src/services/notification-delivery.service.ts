import { Injectable, Logger } from "@nestjs/common";
import nodemailer from "nodemailer";
import { ApiNotification } from "@prisma/client";
import { PrismaService } from "./prisma.service";
import { safePostJson } from "./safe-http";

const LEASE_MS = 60_000;
const RETRY_MS = [60_000, 300_000, 1_800_000, 3_600_000] as const;
const MAX_ATTEMPTS = RETRY_MS.length + 1;

type NotificationWithUser = ApiNotification & { user: { email: string } };

@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async processDue(now = new Date(), limit = 20): Promise<number> {
    await this.recoverExpiredLeases(now);
    const notifications = await this.prisma.apiNotification.findMany({
      where: { status: "pending", nextAttemptAt: { lte: now }, lockedUntil: null, attempts: { lt: MAX_ATTEMPTS } },
      include: { user: { select: { email: true } } },
      orderBy: { nextAttemptAt: "asc" },
      take: Math.min(Math.max(limit, 1), 100)
    });
    let claimed = 0;
    for (let offset = 0; offset < notifications.length; offset += 4) {
      await Promise.all(notifications.slice(offset, offset + 4).map(async candidate => {
        const lockedUntil = new Date(Date.now() + LEASE_MS);
        const notification = await this.prisma.$transaction(async tx => {
          const updated = await tx.apiNotification.updateMany({
            where: { id: candidate.id, status: "pending", attempts: candidate.attempts, lockedUntil: null, nextAttemptAt: { lte: now } },
            data: { attempts: { increment: 1 }, lockedUntil }
          });
          if (!updated.count) return null;
          return tx.apiNotification.findUniqueOrThrow({ where: { id: candidate.id }, include: { user: { select: { email: true } } } });
        });
        if (!notification) return;
        claimed++;
        let error: string | null = null;
        try {
          await this.deliver(notification);
        } catch (cause) {
          error = cause instanceof Error ? cause.message.slice(0, 500) : "Notification delivery failed";
        }
        const success = error === null;
        const completedAt = new Date();
        const exhausted = !success && notification.attempts >= MAX_ATTEMPTS;
        await this.prisma.apiNotification.updateMany({
          where: { id: notification.id, lockedUntil, attempts: notification.attempts },
          data: {
            status: success ? "sent" : exhausted ? "failed" : "pending",
            lockedUntil: null,
            lastError: error,
            sentAt: success ? completedAt : null,
            nextAttemptAt: new Date(completedAt.getTime() + (RETRY_MS[notification.attempts - 1] ?? 0))
          }
        });
      }));
    }
    return claimed;
  }

  private async deliver(notification: NotificationWithUser) {
    const emailEnabled = Boolean(process.env.SMARTQR_SMTP_HOST || process.env.SMTP_HOST);
    const webhookUrl = process.env.API_NOTIFICATION_WEBHOOK_URL;
    if (emailEnabled) await this.deliverEmail(notification);
    if (webhookUrl) await this.deliverWebhook(webhookUrl, notification);
    if (!emailEnabled && !webhookUrl) throw new Error("notification_provider_not_configured");
  }

  private async deliverEmail(notification: NotificationWithUser) {
    const host = process.env.SMARTQR_SMTP_HOST ?? process.env.SMTP_HOST;
    const port = Number(process.env.SMARTQR_SMTP_PORT ?? process.env.SMTP_PORT ?? 587);
    const user = process.env.SMARTQR_SMTP_USER ?? process.env.SMTP_USER;
    const pass = process.env.SMARTQR_SMTP_PASS ?? process.env.SMTP_PASS;
    const secure = (process.env.SMARTQR_SMTP_SECURE ?? process.env.SMTP_SECURE) === "true";
    if (!host) throw new Error("smtp_host_missing");
    const transport = nodemailer.createTransport({ host, port, secure, auth: user && pass ? { user, pass } : undefined });
    await transport.sendMail({
      from: process.env.SMARTQR_SMTP_FROM ?? process.env.SMTP_FROM ?? "SmartQR <no-reply@smartqr.local>",
      to: notification.user.email,
      subject: `[SmartQR] ${this.title(notification.kind)}`,
      text: `${this.title(notification.kind)}\n\n${JSON.stringify(notification.payload, null, 2)}`
    });
  }

  private async deliverWebhook(url: string, notification: NotificationWithUser) {
    await safePostJson(url, JSON.stringify({
      event: `notification.${notification.kind}`,
      data: { id: notification.id, rental_id: notification.rentalId, payload: notification.payload },
      timestamp: new Date().toISOString()
    }), { "User-Agent": "SmartQR-Notifications/1.0" }, { timeoutMs: 10000 });
  }

  private title(kind: string) {
    if (kind === "quota_warning") return "Quota warning";
    if (kind === "key_rotation_warning") return "API key rotation warning";
    if (kind === "webhook_failed") return "Webhook delivery failed";
    return kind.replace(/_/g, " ");
  }

  private async recoverExpiredLeases(now: Date) {
    const result = await this.prisma.apiNotification.updateMany({
      where: { status: "pending", lockedUntil: { lte: now } },
      data: { lockedUntil: null, lastError: "Worker lease expired; delivery outcome unknown" }
    });
    if (result.count) this.logger.warn(`Recovered ${result.count} expired notification worker leases`);
  }
}
