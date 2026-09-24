import { ForbiddenException, Injectable } from "@nestjs/common";
import { ApiKey, ApiRentalOrder, Prisma } from "@prisma/client";
import { getGatePublicKeyForTenant, getLegacyGatePublicKey } from "../security/gate-signing";
import { gateRedisTenantId, GateUsageResourceType } from "../security/gate-tenant";
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
    const publicKey = await getGatePublicKeyForTenant(this.prisma, tenantId);
    return { public_key: publicKey, algorithm: "RS256", tenant_id: tenantId, legacy_public_key: getLegacyGatePublicKey() };
  }

  async revokedDelta(key: IntegrationKey, since: Date) {
    const tenantId = resolveTenantId(key);
    const rows = await this.prisma.revokedResource.findMany({
      where: {
        ...(key.rentalId
          ? { OR: [{ tenantId }, { tenantId: key.userId, resourceType: "ticket" }] }
          : { tenantId }),
        isTest: key.isTest,
        ...(key.showId
          ? { showId: key.showId, resourceType: "ticket" }
          : {}),
        revokedAt: { gt: since }
      },
      select: { resourceType: true, jti: true, revokedAt: true },
      orderBy: { revokedAt: "asc" },
      take: 5000
    });
    return {
      revoked: rows.map((row) => ({ resource_type: row.resourceType, jti: row.jti, revoked_at: row.revokedAt.toISOString() })),
      server_time: new Date().toISOString()
    };
  }

  async reportUsageEvents(key: IntegrationKey, events: UsageEvent[]) {
    const accepted: string[] = [];
    const rejected: { jti: string; reason: "out_of_show_scope" }[] = [];
    const conflicts: { jti: string; first_gate: string; reported_gate: string }[] = [];

    if (key.showId && events.some((event) => event.resource_type === "external_qr")) {
      throw new ForbiddenException({
        error: "show_key_external_qr",
        message: "Scanner key chỉ được đồng bộ vé của show"
      });
    }

    const inScopeTicketJtis = key.showId
      ? new Set((await this.prisma.ticket.findMany({
        where: { showId: key.showId, jti: { in: events.map((event) => event.jti) } },
        select: { jti: true }
      })).map((ticket) => ticket.jti))
      : null;

    for (const event of events) {
      if (inScopeTicketJtis && !inScopeTicketJtis.has(event.jti)) {
        rejected.push({ jti: event.jti, reason: "out_of_show_scope" });
        continue;
      }
      const tenantId = this.redisTenantId(key, event.resource_type);
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
    return { accepted_count: accepted.length, conflicts, rejected };
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
    const resourceTypes: GateUsageResourceType[] = key.showId
      ? ["ticket"]
      : ["external_qr", "ticket"];
    const tenantIds = Array.from(new Set(resourceTypes.map((resourceType) => this.redisTenantId(key, resourceType))));
    const redisKeys = (await Promise.all(tenantIds.map((tenantId) => this.redis.keys(`gate:conflict:${tenantId}:*`)))).flat();
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
    if (key.showId) return { showId: key.showId };
    // Show tickets are owned by the show tenant, not by an API rental. API-rental
    // keys therefore fall back to their userId for ticket usage sync.
    return { show: { ownerId: key.userId } };
  }

  private redisTenantId(key: IntegrationKey, resourceType: GateUsageResourceType) {
    return gateRedisTenantId(key, resourceType);
  }
}
