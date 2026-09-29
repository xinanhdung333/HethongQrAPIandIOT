"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GatesController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../security/auth.service");
const api_key_decorator_1 = require("../security/api-key.decorator");
const tenant_1 = require("../security/tenant");
const gate_sync_service_1 = require("../services/gate-sync.service");
const prisma_service_1 = require("../services/prisma.service");
let GatesController = class GatesController {
    gates;
    auth;
    prisma;
    constructor(gates, auth, prisma) {
        this.gates = gates;
        this.auth = auth;
        this.prisma = prisma;
    }
    async publicKey(raw) {
        const key = await this.requireKey(raw);
        return this.gates.publicKeyForTenant((0, tenant_1.resolveTenantId)(key));
    }
    async enableOffline(raw) {
        const key = await this.requireKey(raw);
        const tenantId = (0, tenant_1.resolveTenantId)(key);
        await (0, tenant_1.enableOfflineCapable)(this.prisma, tenantId, key.userId);
        const settings = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });
        return { tenant_id: tenantId, offline_capable: true, enabled_at: settings?.enabledAt ?? null };
    }
    async tenantSettings(raw) {
        const key = await this.requireKey(raw);
        const tenantId = (0, tenant_1.resolveTenantId)(key);
        const settings = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });
        return { tenant_id: tenantId, offline_capable: settings?.offlineCapable ?? false, enabled_at: settings?.enabledAt ?? null };
    }
    async sessionPublicKey(authorization) {
        const session = await this.auth.sessionFromAuthorization(authorization);
        if (!session)
            throw new common_1.UnauthorizedException({ error: "unauthorized", message: "Login required" });
        if (!(await (0, tenant_1.isOfflineCapable)(this.prisma, session.sub))) {
            throw new common_1.BadRequestException({ error: "tenant_offline_disabled", message: "Tenant nay chua bat che do quet offline" });
        }
        return this.gates.publicKeyForTenant(session.sub);
    }
    async revokedDelta(raw, since) {
        const key = await this.requireKey(raw);
        const sinceDate = since ? new Date(since) : new Date(0);
        if (Number.isNaN(sinceDate.getTime()))
            throw new common_1.BadRequestException({ error: "invalid_since", message: "since must be an ISO date" });
        return this.gates.revokedDelta(key, sinceDate);
    }
    async usageEvents(raw, body) {
        const key = await this.requireKey(raw);
        if (!Array.isArray(body.events) || body.events.length === 0 || body.events.length > 500) {
            throw new common_1.BadRequestException({ error: "invalid_events", message: "events must contain 1-500 items" });
        }
        const invalid = body.events.some((event) => !event?.jti ||
            !event.gate_id ||
            !event.used_at ||
            (event.resource_type !== "external_qr" && event.resource_type !== "ticket"));
        if (invalid) {
            throw new common_1.BadRequestException({ error: "invalid_events", message: "each event must include jti, gate_id, used_at, and resource_type" });
        }
        return this.gates.reportUsageEvents(key, body.events);
    }
    async conflicts(raw) {
        const key = await this.requireKey(raw);
        return this.gates.listConflicts(key);
    }
    async requireKey(raw) {
        const key = await this.auth.getApiKey(raw);
        if (!key)
            throw new common_1.UnauthorizedException({ error: "invalid_api_key", message: "Invalid or expired API key" });
        return key;
    }
};
exports.GatesController = GatesController;
__decorate([
    (0, common_1.Get)("public-key"),
    (0, api_key_decorator_1.RequireApiKey)("ticket:verify"),
    __param(0, (0, common_1.Headers)("x-api-key")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GatesController.prototype, "publicKey", null);
__decorate([
    (0, common_1.Post)("tenant-settings/enable-offline"),
    (0, api_key_decorator_1.RequireApiKey)("qr:create"),
    __param(0, (0, common_1.Headers)("x-api-key")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GatesController.prototype, "enableOffline", null);
__decorate([
    (0, common_1.Get)("tenant-settings"),
    (0, api_key_decorator_1.RequireApiKey)("qr:create"),
    __param(0, (0, common_1.Headers)("x-api-key")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GatesController.prototype, "tenantSettings", null);
__decorate([
    (0, common_1.Get)("session-public-key"),
    __param(0, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GatesController.prototype, "sessionPublicKey", null);
__decorate([
    (0, common_1.Get)("revoked-delta"),
    (0, api_key_decorator_1.RequireApiKey)("ticket:verify"),
    __param(0, (0, common_1.Headers)("x-api-key")),
    __param(1, (0, common_1.Query)("since")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], GatesController.prototype, "revokedDelta", null);
__decorate([
    (0, common_1.Post)("usage-events"),
    (0, api_key_decorator_1.RequireApiKey)("ticket:verify"),
    __param(0, (0, common_1.Headers)("x-api-key")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], GatesController.prototype, "usageEvents", null);
__decorate([
    (0, common_1.Get)("conflicts"),
    (0, api_key_decorator_1.RequireApiKey)("ticket:verify"),
    __param(0, (0, common_1.Headers)("x-api-key")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GatesController.prototype, "conflicts", null);
exports.GatesController = GatesController = __decorate([
    (0, common_1.Controller)("api/v1/gates"),
    __metadata("design:paramtypes", [gate_sync_service_1.GateSyncService, auth_service_1.AuthService, prisma_service_1.PrismaService])
], GatesController);
