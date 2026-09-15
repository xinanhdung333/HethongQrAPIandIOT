import { Injectable, Logger } from "@nestjs/common";
import { Prisma, WebhookEvent } from "@prisma/client";
import { createHmac, randomUUID } from "node:crypto";
import { generateSecret, openSecret, sealSecret } from "../security/secret-box";
import { PrismaService } from "./prisma.service";
import { safePostJson } from "./safe-http";

export const WEBHOOK_RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000] as const;
const MAX_ATTEMPTS = WEBHOOK_RETRY_DELAYS_MS.length + 1;
const LEASE_MS = 60_000;

export function webhookSignature(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Call inside the same database transaction as the business operation (transactional outbox). */
  async enqueue(tx: Prisma.TransactionClient, rentalId: string | null | undefined, event: string, data: unknown, dedupeKey?: string) {
    if (!rentalId) return null;
    const rental = await tx.apiRentalOrder.findUnique({ where: { id: rentalId } });
    if (!rental?.callbackUrl) return null;
    let storedSecret = rental.webhookSecret;
    if (!storedSecret) {
      const generated = sealSecret(generateSecret("whsec_"));
      await tx.apiRentalOrder.updateMany({ where: { id: rentalId, webhookSecret: null }, data: { webhookSecret: generated } });
      const current = await tx.apiRentalOrder.findUniqueOrThrow({ where: { id: rentalId } });
      storedSecret = current.webhookSecret!;
    }
    const createEvent = async (name: string, legacy = false) => {
      const id = `evt_${randomUUID()}`;
      const timestamp = new Date().toISOString();
      const legacyFields = legacy && data && typeof data === "object" && !Array.isArray(data) ? data : {};
      const body = JSON.stringify({ ...legacyFields, ...(legacy ? { created_at: timestamp } : {}), id, event: name, data, timestamp });
      const key = dedupeKey ? `${rentalId}:${name}:${dedupeKey}` : undefined;
      const record = { id, rentalId, event: name, body, targetUrl: rental.callbackUrl!, secret: storedSecret!, dedupeKey: key };
      return key
        ? tx.webhookEvent.upsert({ where: { dedupeKey: key }, update: {}, create: record })
        : tx.webhookEvent.create({ data: record });
    };
    const queued = await createEvent(event);
    if (event === "ticket.verified") await createEvent("qr.verified", true);
    return queued;
  }

  /** Injectable transport seam allows real socket integration tests without external callbacks. */
  protected deliver(event: WebhookEvent) {
    return safePostJson(event.targetUrl, event.body, {
      "X-Webhook-Signature": webhookSignature(openSecret(event.secret), event.body),
      "X-Webhook-Id": event.id,
      "X-Webhook-Attempt": String(event.attempts),
      "X-SMARTQR-EVENT": event.event,
      "User-Agent": "SmartQR-Webhooks/1.0"
    });
  }

  async processDue(now = new Date(), limit = 20): Promise<number> {
    await this.recoverExpiredLeases(now);
    const candidates = await this.prisma.webhookEvent.findMany({
      where: { status: "pending", nextAttemptAt: { lte: now }, lockedUntil: null, attempts: { lt: MAX_ATTEMPTS } },
      orderBy: { nextAttemptAt: "asc" }, take: Math.min(Math.max(limit, 1), 100)
    });
    let claimed = 0;
    // Bounded batches prevent a slow callback from starving the remainder of the queue.
    for (let offset = 0; offset < candidates.length; offset += 4) {
      await Promise.all(candidates.slice(offset, offset + 4).map(async candidate => {
        const lockedUntil = new Date(Date.now() + LEASE_MS);
        const event = await this.prisma.$transaction(async tx => {
          const updated = await tx.webhookEvent.updateMany({
            where: { id: candidate.id, status: "pending", attempts: candidate.attempts, lockedUntil: null, nextAttemptAt: { lte: now } },
            data: { attempts: { increment: 1 }, lockedUntil }
          });
          if (!updated.count) return null;
          const record = await tx.webhookEvent.findUniqueOrThrow({ where: { id: candidate.id } });
          await tx.webhookAttempt.create({ data: { eventId: record.id, attempt: record.attempts, error: "delivery_in_progress", durationMs: 0 } });
          return record;
        });
        if (!event) return;
        claimed++;
        const started = Date.now();
        let statusCode: number | undefined;
        let error: string | undefined;
        try {
          statusCode = (await this.deliver(event)).statusCode;
          if (statusCode < 200 || statusCode >= 300) error = `Callback returned HTTP ${statusCode}`;
        } catch (cause) {
          // Do not log response bodies, credentials, or full callback URLs.
          error = cause instanceof Error ? cause.message.slice(0, 500) : "Callback delivery failed";
        }
        const completedAt = new Date();
        const success = error === undefined;
        await this.prisma.$transaction(async tx => {
          const exhausted = !success && event.attempts >= MAX_ATTEMPTS;
          const updated = await tx.webhookEvent.updateMany({
            where: { id: event.id, lockedUntil, attempts: event.attempts, status: "pending" },
            data: {
              status: success ? "delivered" : exhausted ? "failed" : "pending",
              lockedUntil: null,
              deliveredAt: success ? completedAt : null,
              nextAttemptAt: new Date(completedAt.getTime() + (WEBHOOK_RETRY_DELAYS_MS[event.attempts - 1] ?? 0))
            }
          });
          if (!updated.count) return;
          await tx.webhookAttempt.updateMany({
            where: { eventId: event.id, attempt: event.attempts },
            data: { statusCode: statusCode ?? null, error: error ?? null, durationMs: Date.now() - started }
          });
          if (exhausted) {
            const rental = await tx.apiRentalOrder.findUnique({ where: { id: event.rentalId } });
            if (rental) await tx.apiNotification.upsert({
              where: { dedupeKey: `webhook_failed:${event.id}` },
              update: {},
              create: { userId: rental.userId, rentalId: rental.id, dedupeKey: `webhook_failed:${event.id}`, kind: "webhook_failed", payload: { event_id: event.id, event: event.event, attempts: event.attempts, last_error: error ?? null } }
            });
          }
        });
      }));
    }
    return claimed;
  }

  private async recoverExpiredLeases(now: Date) {
    const abandoned = await this.prisma.webhookEvent.findMany({
      where: { status: "pending", lockedUntil: { lte: now } }, take: 100
    });
    for (const event of abandoned) {
      await this.prisma.$transaction(async tx => {
        const recovered = await tx.webhookEvent.updateMany({
          where: { id: event.id, status: "pending", lockedUntil: event.lockedUntil, attempts: event.attempts },
          data: {
            lockedUntil: null,
            status: event.attempts >= MAX_ATTEMPTS ? "failed" : "pending",
            nextAttemptAt: new Date(now.getTime() + (WEBHOOK_RETRY_DELAYS_MS[event.attempts - 1] ?? 0))
          }
        });
        if (!recovered.count) return;
        await tx.webhookAttempt.updateMany({
          where: { eventId: event.id, attempt: event.attempts, error: "delivery_in_progress" },
          data: { error: "Worker lease expired; delivery outcome unknown", durationMs: LEASE_MS }
        });
      });
    }
    if (abandoned.length) this.logger.warn(`Recovered ${abandoned.length} expired webhook worker leases`);
  }
}
