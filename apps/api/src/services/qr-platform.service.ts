import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ApiKey, ApiRentalOrder, ExternalQrCode, Prisma } from "@prisma/client";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import { ApiCreateQrDto, ApiVerifyQrDto } from "../api-qr.dto";
import { ApiKeyScope } from "../security/api-key.decorator";
import { AuthService } from "../security/auth.service";
import { signOfflineQrToken } from "../security/gate-signing";
import { isOfflineCapable, resolveTenantId } from "../security/tenant";
import { PrismaService } from "./prisma.service";
import { WebhookDeliveryService } from "./webhook-delivery.service";
import { SystemSettingsService } from "./system-settings.service";

type IntegrationKey = ApiKey & { rental: ApiRentalOrder | null };
type RequestMeta = { ip?: string; userAgent?: string };
type OwnedQr = ExternalQrCode & { apiKey: ApiKey };
type JsonRecord = Record<string, unknown>;
const DEFAULT_TTL = 60 * 60 * 24 * 30;
const MAX_TTL = 60 * 60 * 24 * 365;
const API_PUBLIC_URL = process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;

/** Database transactions are the authority for consumption, quota and retries. */
@Injectable()
export class QrPlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly webhooks: WebhookDeliveryService,
    private readonly settings: SystemSettingsService
  ) {}

  async createExternalQrCode(dto: ApiCreateQrDto, raw?: string, idempotencyKey?: string) {
    const key = await this.requireKey(raw, "qr:create");
    this.validateResource(dto);
    return this.transaction(key, "qr.create", dto, idempotencyKey, async (tx, current) => {
      await this.reserveQuota(tx, current, 1);
      return this.createOne(tx, current, dto);
    });
  }

  async createBulk(resources: ApiCreateQrDto[], raw?: string, idempotencyKey?: string) {
    const key = await this.requireKey(raw, "qr:create");
    await this.assertFeature("bulk_create", "Bulk QR create is disabled by admin settings");
    if (!Array.isArray(resources) || resources.length < 1 || resources.length > 500) {
      throw new BadRequestException({ error: "invalid_bulk_size", message: "resources must contain between 1 and 500 QR codes" });
    }
    for (const resource of resources) this.validateResource(resource);
    return this.transaction(key, "qr.bulk", { resources }, idempotencyKey, async (tx, current) => {
      await this.reserveQuota(tx, current, resources.length);
      const results = [];
      for (const resource of resources) results.push(await this.createOne(tx, current, resource));
      return { results, count: results.length, is_test: current.isTest };
    });
  }

  async getExternalQrCode(id: string, raw?: string) {
    const key = await this.requireKey(raw, "qr:read");
    const qr = await this.prisma.externalQrCode.findUnique({ where: { id }, include: { apiKey: true } });
    if (!qr || !this.owns(key, qr)) throw new NotFoundException({ error: "qr_not_found", message: "QR code not found" });
    return this.serializeQr(qr, resolveTenantId({ rentalId: qr.apiKey.rentalId, userId: qr.userId }));
  }

  async getExternalQrSvg(id: string, raw?: string) {
    const qr = await this.getExternalQrCode(id, raw);
    return QRCode.toString(qr.qr_jwt, {
      type: "svg", errorCorrectionLevel: "H", margin: 2, width: 256,
      color: { dark: "#18181b", light: "#ffffff" }
    });
  }

  async revoke(id: string, raw?: string, idempotencyKey?: string) {
    const key = await this.requireKey(raw, "qr:create");
    if (!this.auth.apiKeyHasScope(key.scopes, "qr:read")) throw new ForbiddenException({ error: "forbidden_scope", message: "API key does not have 'qr:read' permission" });
    return this.transaction(key, "qr.revoke", { id }, idempotencyKey, async (tx, current) => {
      await tx.$executeRaw`SELECT id FROM external_qr_codes WHERE id = ${id} FOR UPDATE`;
      const qr = await tx.externalQrCode.findUnique({ where: { id }, include: { apiKey: true } });
      if (!qr || !this.owns(current, qr)) throw new NotFoundException({ error: "qr_not_found", message: "QR code not found" });
      if (qr.revokedAt) return this.serializeQr(qr, resolveTenantId({ rentalId: qr.apiKey.rentalId, userId: qr.userId }));
      const revoked = await tx.externalQrCode.update({ where: { id }, data: { revokedAt: new Date() } });
      const result = await this.serializeQr(revoked, resolveTenantId(current));
      if (current.rentalId) await this.webhooks.enqueue(tx, current.rentalId, "qr.revoked", result, `qr.revoked:${id}`);
      return result;
    });
  }

  /** Returns null only for an existing legacy event ticket when fallback is enabled. */
  async verifyExternal(dto: ApiVerifyQrDto, raw?: string, meta?: RequestMeta, idempotencyKey?: string, allowLegacy = false): Promise<JsonRecord | null> {
    if (!raw && allowLegacy && process.env.NODE_ENV !== "production") return null;
    const key = await this.requireKey(raw, "ticket:verify");
    if (!dto.qr_jwt && !dto.ticket_code) throw new BadRequestException({ error: "missing_qr", message: "qr_jwt or ticket_code is required" });
    if (!dto.gate_id?.trim()) throw new BadRequestException({ error: "missing_gate", message: "gate_id is required" });
    const token = dto.qr_jwt || dto.ticket_code!;
    if (allowLegacy && token.includes(".")) {
      const legacy = await this.prisma.ticket.findFirst({ where: { qrJwt: token }, select: { id: true } });
      if (legacy) {
        if (key.isTest) throw new ForbiddenException({ error: "sandbox_isolation", message: "Test keys cannot verify live event tickets" });
        return null;
      }
    }
    return this.transaction(key, "qr.verify", dto, idempotencyKey, async (tx, current) => {
      const where = dto.qr_jwt || token.includes(".") ? { qrJwt: token } : { code: token };
      let qr = await tx.externalQrCode.findFirst({ where, include: { apiKey: true } });
      if (!qr || !this.owns(current, qr)) return this.deny(tx, current, null, dto, "qr_not_found", "QR code not found", meta);
      await tx.$executeRaw`SELECT id FROM external_qr_codes WHERE id = ${qr.id} FOR UPDATE`;
      qr = await tx.externalQrCode.findUniqueOrThrow({ where: { id: qr.id }, include: { apiKey: true } });
      const now = new Date();
      if (qr.revokedAt) return this.deny(tx, current, qr, dto, "qr_revoked", "QR code revoked", meta);
      if (qr.expiresAt <= now) return this.deny(tx, current, qr, dto, "qr_expired", "QR code expired", meta);
      if (qr.notBefore && qr.notBefore > now) return this.deny(tx, current, qr, dto, "qr_not_active", "QR code is not active yet", meta);
      if (qr.isUsed || qr.useCount >= qr.maxUses) return this.deny(tx, current, qr, dto, "qr_already_used", "QR code already used", meta);
      if (Array.isArray(qr.allowedGateIds) && qr.allowedGateIds.length && !qr.allowedGateIds.includes(dto.gate_id)) {
        return this.deny(tx, current, qr, dto, "gate_not_allowed", "QR code is not allowed at this gate", meta);
      }
      // The database controls revocation and use count; multi-use QR tokens do not rely on a Redis session.
      try {
        const decoded = this.auth.decodeJwt<{ jti: string; type?: string }>(qr.qrJwt);
        if (decoded.jti !== qr.jti || decoded.type !== "external_qr") throw new Error("Invalid token claims");
      } catch {
        return this.deny(tx, current, qr, dto, "invalid_qr", "Invalid QR signature", meta);
      }
      const updated = await tx.externalQrCode.update({
        where: { id: qr.id }, data: { useCount: { increment: 1 }, isUsed: qr.useCount + 1 >= qr.maxUses, usedAt: now }
      });
      await this.recordScan(tx, updated, dto.gate_id, true, null, meta);
      await this.recordVerifyUsage(tx, current, true, qr.resourceType);
      const result = {
        valid: true, decision: "allow", type: "external_qr", qr_id: qr.id, gate_id: dto.gate_id,
        resource_type: qr.resourceType, resource_id: qr.resourceId, customer_ref: qr.customerRef,
        payload: qr.payload, metadata: qr.metadata, is_test: qr.isTest,
        use_count: updated.useCount, max_uses: updated.maxUses, remaining_uses: Math.max(0, updated.maxUses - updated.useCount),
        verified_at: now.toISOString()
      };
      if (current.rentalId) {
        await this.webhooks.enqueue(tx, current.rentalId, "ticket.verified", result, `ticket.verified:${qr.id}:${updated.useCount}`);
        // Older integrations receive the original event name during the v1 compatibility period.
        await this.webhooks.enqueue(tx, current.rentalId, "qr.verified", result, `qr.verified:${qr.id}:${updated.useCount}`);
      }
      return result;
    });
  }

  private validateResource(dto: ApiCreateQrDto) {
    if (!dto || typeof dto.resource_type !== "string" || !dto.resource_type.trim() || typeof dto.resource_id !== "string" || !dto.resource_id.trim()) {
      throw new BadRequestException({ error: "invalid_resource", message: "resource_type and resource_id must be non-empty strings" });
    }
    if (Buffer.byteLength(JSON.stringify(dto.metadata ?? {}), "utf8") > 4096) {
      throw new BadRequestException({ error: "metadata_too_large", message: "metadata must not exceed 4 KiB" });
    }
    if (Buffer.byteLength(JSON.stringify(dto.payload ?? {}), "utf8") > 65536) {
      throw new BadRequestException({ error: "payload_too_large", message: "payload must not exceed 64 KiB" });
    }
    if (dto.not_before && (!Number.isFinite(Date.parse(dto.not_before)) || Date.parse(dto.not_before) >= Date.now() + Math.min(dto.ttl_seconds ?? DEFAULT_TTL, MAX_TTL) * 1000)) {
      throw new BadRequestException({ error: "invalid_activation_time", message: "not_before must be a valid date before the QR expiration" });
    }
  }

  private async requireKey(raw: string | undefined, scope: ApiKeyScope): Promise<IntegrationKey> {
    if (!raw) throw new UnauthorizedException({ error: "missing_api_key", message: "Missing API key" });
    const key = await this.auth.getApiKey(raw);
    if (!key) throw new UnauthorizedException({ error: "invalid_api_key", message: "Invalid or expired API key" });
    if (!this.auth.apiKeyHasScope(key.scopes, scope)) {
      throw new ForbiddenException({ error: "forbidden_scope", message: `API key does not have '${scope}' permission` });
    }
    return key as IntegrationKey;
  }

  private owns(key: IntegrationKey, qr: OwnedQr) {
    if (key.userId !== qr.userId || key.isTest !== qr.isTest) return false;
    if (key.rentalId || qr.apiKey.rentalId) return Boolean(key.rentalId && key.rentalId === qr.apiKey.rentalId);
    // Pre-migration keys had user-level ownership; preserve that contract.
    return true;
  }

  private async transaction<T>(key: IntegrationKey, operation: string, body: unknown, idempotencyKey: string | undefined, work: (tx: Prisma.TransactionClient, current: IntegrationKey) => Promise<T>): Promise<T> {
    if (idempotencyKey !== undefined && !/^[\x21-\x7E]{1,200}$/.test(idempotencyKey)) {
      throw new BadRequestException({ error: "invalid_idempotency_key", message: "Idempotency-Key must contain 1-200 printable characters without spaces" });
    }
    const scopeId = `${resolveTenantId(key)}:${key.isTest ? "test" : "live"}`;
    const requestHash = crypto.createHash("sha256").update(this.canonical(body)).digest("hex");
    return this.prisma.$transaction(async (tx) => {
      // Cross-process serialization also makes quota shared by old/new keys during rotation.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`smartqr:${scopeId}`}, 0))`;
      const current = await tx.apiKey.findUnique({ where: { id: key.id }, include: { rental: true } });
      if (!current || current.status === "revoked" || (current.revokeAt && current.revokeAt <= new Date())) {
        throw new UnauthorizedException({ error: "invalid_api_key", message: "Invalid or expired API key" });
      }
      const where = { scopeId_operation_key: { scopeId, operation, key: idempotencyKey ?? "" } };
      if (idempotencyKey) {
        const prior = await tx.apiIdempotency.findUnique({ where });
        if (prior && prior.expiresAt > new Date()) {
          if (prior.requestHash !== requestHash) throw new ConflictException({ error: "idempotency_conflict", message: "Idempotency-Key was already used with a different request" });
          return prior.response as T;
        }
        if (prior) await tx.apiIdempotency.delete({ where });
      }
      const response = await work(tx, current);
      if (idempotencyKey) await tx.apiIdempotency.create({
        data: { scopeId, operation, key: idempotencyKey, requestHash, response: this.json(response), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
      });
      return response;
    }, { timeout: 60000, maxWait: 30000 });
  }

  private canonical(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((item) => this.canonical(item)).join(",")}]`;
    if (value !== null && typeof value === "object") {
      return `{${Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, entry]) => `${JSON.stringify(name)}:${this.canonical(entry)}`).join(",")}}`;
    }
    return JSON.stringify(value) ?? "null";
  }

  private periodKey(key: IntegrationKey) {
    return { scopeId: resolveTenantId(key), month: new Date().toISOString().slice(0, 7), isTest: key.isTest };
  }

  private async reserveQuota(tx: Prisma.TransactionClient, key: IntegrationKey, count: number) {
    const periodKey = this.periodKey(key);
    if (!key.isTest && key.rental?.billingMode === "payg") await this.assertFeature("pay_as_you_go", "Pay-as-you-go metering is disabled by admin settings");
    const period = await tx.apiUsagePeriod.upsert({ where: { scopeId_month_isTest: periodKey }, create: periodKey, update: {} });
    const quota = key.rental?.quota ?? key.quota;
    if (!key.isTest && key.rental?.billingMode !== "payg" && period.qrCreated + count > quota) {
      throw new HttpException({ error: "quota_exceeded", message: `Monthly QR quota exceeded (${period.qrCreated}/${quota}); upgrade the plan or enable pay-as-you-go` }, 429);
    }
    const cost = !key.isTest && key.rental?.billingMode === "payg" ? count * key.rental.createUnitPrice : 0;
    await tx.apiUsagePeriod.update({ where: { id: period.id }, data: { qrCreated: { increment: count }, billedAmount: { increment: cost } } });
  }

  private async createOne(tx: Prisma.TransactionClient, key: IntegrationKey, dto: ApiCreateQrDto) {
    const ttl = Math.min(Math.max(dto.ttl_seconds ?? DEFAULT_TTL, 60), MAX_TTL);
    const jti = crypto.randomBytes(18).toString("hex");
    const token = jwt.sign({
      sub: `external:${dto.resource_type}:${dto.resource_id}`, type: "external_qr", owner_id: key.userId,
      resource_type: dto.resource_type, resource_id: dto.resource_id, customer_ref: dto.customer_ref,
      is_test: key.isTest, jti
    }, process.env.JWT_SECRET ?? "dev-secret", { expiresIn: ttl });
    const qr = await tx.externalQrCode.create({
      data: {
        userId: key.userId, apiKeyId: key.id, jti, code: `SQR-${crypto.randomBytes(8).toString("hex").toUpperCase()}`,
        qrJwt: token, resourceType: dto.resource_type, resourceId: dto.resource_id, customerRef: dto.customer_ref?.trim() || null,
        payload: dto.payload ? this.json(dto.payload) : Prisma.JsonNull,
        metadata: dto.metadata ? this.json(dto.metadata) : Prisma.JsonNull,
        isTest: key.isTest, maxUses: dto.max_uses ?? 1, allowedGateIds: Array.from(new Set(dto.allowed_gate_ids ?? [])),
        notBefore: dto.not_before ? new Date(dto.not_before) : null, expiresAt: new Date(Date.now() + ttl * 1000)
      }
    });
    const cost = !key.isTest && key.rental?.billingMode === "payg" ? key.rental.createUnitPrice : 0;
    await tx.apiUsageEvent.create({ data: { userId: key.userId, apiKeyId: key.id, rentalId: key.rentalId, action: "qr.create", resourceType: qr.resourceType, isTest: key.isTest, success: true, cost } });
    const result = await this.serializeQr(qr, resolveTenantId(key));
    if (key.rentalId) await this.webhooks.enqueue(tx, key.rentalId, "qr.created", result, `qr.created:${qr.id}`);
    return result;
  }

  private async serializeQr(qr: ExternalQrCode, tenantId: string) {
    const offlineCapable = await isOfflineCapable(this.prisma, tenantId);
    const qrOfflineJwt = offlineCapable ? await signOfflineQrToken(this.prisma, qr, tenantId) : undefined;
    return {
      id: qr.id, type: "external_qr", qr_jwt: qr.qrJwt, ticket_code: qr.code,
      ...(qrOfflineJwt ? { qr_offline_jwt: qrOfflineJwt } : {}),
      qr: { value: qr.qrJwt, format: "jwt", code: qr.code, image_url: `${API_PUBLIC_URL}/api/v1/qr-codes/${qr.id}/svg` },
      resource: { type: qr.resourceType, id: qr.resourceId, customer_ref: qr.customerRef },
      payload: qr.payload, metadata: qr.metadata, is_test: qr.isTest,
      max_uses: qr.maxUses, use_count: qr.useCount, remaining_uses: Math.max(0, qr.maxUses - qr.useCount),
      allowed_gate_ids: qr.allowedGateIds, not_before: qr.notBefore?.toISOString() ?? null,
      expires_at: qr.expiresAt.toISOString(), revoked_at: qr.revokedAt?.toISOString() ?? null,
      status: qr.revokedAt ? "revoked" : qr.expiresAt.getTime() <= Date.now() ? "expired" : qr.isUsed ? "used" : qr.notBefore && qr.notBefore.getTime() > Date.now() ? "scheduled" : "active"
    };
  }

  private async deny(tx: Prisma.TransactionClient, key: IntegrationKey, qr: ExternalQrCode | null, dto: ApiVerifyQrDto, error: string, reason: string, meta?: RequestMeta) {
    if (qr) await this.recordScan(tx, qr, dto.gate_id, false, reason, meta);
    await this.recordVerifyUsage(tx, key, false, qr?.resourceType);
    const result = { valid: false, decision: "deny", error, message: reason, reason, gate_id: dto.gate_id, ...(qr ? { qr_id: qr.id, is_test: qr.isTest } : { is_test: key.isTest }) };
    if (key.rentalId) await this.webhooks.enqueue(tx, key.rentalId, "qr.verify_failed", result);
    return result;
  }

  private async recordScan(tx: Prisma.TransactionClient, qr: ExternalQrCode, gateId: string, valid: boolean, reason: string | null, meta?: RequestMeta) {
    await tx.externalQrScanLog.create({ data: { externalQrId: qr.id, userId: qr.userId, gateId, valid, reason, ip: meta?.ip, userAgent: meta?.userAgent } });
  }

  private async recordVerifyUsage(tx: Prisma.TransactionClient, key: IntegrationKey, success: boolean, resourceType?: string) {
    const periodKey = this.periodKey(key);
    if (!key.isTest && key.rental?.billingMode === "payg") await this.assertFeature("pay_as_you_go", "Pay-as-you-go metering is disabled by admin settings");
    const cost = !key.isTest && key.rental?.billingMode === "payg" ? key.rental.verifyUnitPrice : 0;
    const totals = { verifySuccess: success ? 1 : 0, verifyFailed: success ? 0 : 1, billedAmount: cost };
    await tx.apiUsagePeriod.upsert({
      where: { scopeId_month_isTest: periodKey }, create: { ...periodKey, ...totals },
      update: { verifySuccess: { increment: totals.verifySuccess }, verifyFailed: { increment: totals.verifyFailed }, billedAmount: { increment: cost } }
    });
    await tx.apiUsageEvent.create({ data: { userId: key.userId, apiKeyId: key.id, rentalId: key.rentalId, action: "qr.verify", resourceType, isTest: key.isTest, success, cost } });
  }

  private async assertFeature(name: string, message: string) {
    const platform = await this.settings.apiPlatform();
    if (platform.feature_flags[name] === false) throw new ForbiddenException({ error: "feature_disabled", message });
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}

