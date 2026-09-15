import { ForbiddenException, Injectable } from "@nestjs/common";
import { ApiKey, ApiRentalOrder, Prisma } from "@prisma/client";
import { getGateKeyPairForTenant, getLegacyGatePublicKey } from "../security/gate-signing";
import { isOfflineCapable, resolveTenantId } from "../security/tenant";
import { PrismaService } from "./prisma.service";
import { RedisService } from "./redis.service";

type IntegrationKey = ApiKey & { rental: ApiRentalOrder | null };
export type UsageResourceType = "external_qr" | "ticket";
export type UsageEvent = { jti: string; gate_id: string; used_at: string; resource_type: UsageResourceType };

const USED_TTL_SECONDS = 60 * 60 * 24 * 400;

@Injectable()
export class GateSyncService {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}

  async publicKeyForTenant(tenantId: string) {
    const capable = await isOfflineCapable(this.prisma, tenantId);
    if (!capable) {
      throw new ForbiddenException({ error: "tenant_offline_disabled", message: "Tenant nay chua bat che do quet offline" });
    }
    const { publicKey } = await getGateKeyPairForTenant(this.prisma, tenantId);
    return { public_key: publicKey, algorithm: "RS256", tenant_id: tenantId, legacy_public_key: getLegacyGatePublicKey() };
  }

  async revokedDelta(key: IntegrationKey, since: Date) {
    // TODO: ticket revocation not implemented.
    const rows = await this.prisma.externalQrCode.findMany({
      where: {
        ...this.tenantQrWhere(key),
        isTest: key.isTest,
        revokedAt: { not: null, gt: since }
      },
      select: { jti: true, revokedAt: true },
      orderBy: { revokedAt: "asc" },
      take: 5000
    });
    return {
      revoked: rows.map((row) => ({ jti: row.jti, revoked_at: row.revokedAt!.toISOString() })),
      server_time: new Date().toISOString()
    };
  }

  async reportUsageEvents(key: IntegrationKey, events: UsageEvent[]) {
    const accepted: string[] = [];
    const conflicts: { jti: string; first_gate: string; reported_gate: string }[] = [];

    for (const event of events) {
      const tenantId = resolveTenantId(key);
      const redisKey = `gate:used:${tenantId}:${event.jti}`;
      const claim = `${event.gate_id}|${event.used_at}`;
      const existing = await this.redis.get(redisKey);
      if (!existing) {
        await this.redis.set(redisKey, claim, USED_TTL_SECONDS);
        accepted.push(event.jti);
        await this.markUsedInDb(key, event);
      } else {
        const [firstGate] = existing.split("|");
        if (firstGate !== event.gate_id) {
          conflicts.push({ jti: event.jti, first_gate: firstGate, reported_gate: event.gate_id });
          await this.redis.set(`gate:conflict:${tenantId}:${event.jti}:${event.gate_id}`, claim, USED_TTL_SECONDS);
        }
      }
    }
    return { accepted_count: accepted.length, conflicts };
  }

  private async markUsedInDb(key: IntegrationKey, event: UsageEvent) {
    const usedAt = new Date(event.used_at);
    const normalizedUsedAt = Number.isNaN(usedAt.getTime()) ? new Date() : usedAt;
    if (event.resource_type === "external_qr") {
      await this.prisma.externalQrCode.updateMany({
        where: {
          jti: event.jti,
          ...this.tenantQrWhere(key),
          isTest: key.isTest,
          isUsed: false
        },
        data: { isUsed: true, usedAt: normalizedUsedAt, useCount: { increment: 1 } }
      });
      return;
    }

    await this.prisma.ticket.updateMany({
      where: {
        jti: event.jti,
        ...this.tenantTicketWhere(key),
        isUsed: false
      },
      data: { isUsed: true, usedAt: normalizedUsedAt, useCount: { increment: 1 } }
    });
  }

  async listConflicts(key: IntegrationKey) {
    const pattern = `gate:conflict:${resolveTenantId(key)}:*`;
    const redisKeys = await this.redis.keys(pattern);
    const result: { redis_key: string; reported_gate: string; used_at: string }[] = [];
    for (const redisKey of redisKeys) {
      const value = await this.redis.get(redisKey);
      if (value) {
        const [gate, usedAt] = value.split("|");
        result.push({ redis_key: redisKey, reported_gate: gate, used_at: usedAt });
      }
    }
    return result;
  }

  private tenantQrWhere(key: IntegrationKey): Prisma.ExternalQrCodeWhereInput {
    if (key.rentalId) return { apiKey: { rentalId: key.rentalId } };
    return { userId: key.userId, apiKey: { rentalId: null } };
  }

  private tenantTicketWhere(key: IntegrationKey): Prisma.TicketWhereInput {
    // Show tickets are owned by the show tenant, not by an API rental. API-rental
    // keys therefore fall back to their userId for ticket usage sync.
    return { show: { ownerId: key.userId } };
  }
}
