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
exports.DeveloperController = void 0;
const common_1 = require("@nestjs/common");
const developer_dto_1 = require("../developer.dto");
const auth_service_1 = require("../security/auth.service");
const activity_log_service_1 = require("../services/activity-log.service");
const developer_service_1 = require("../services/developer.service");
let DeveloperController = class DeveloperController {
    developer;
    auth;
    activity;
    constructor(developer, auth, activity) {
        this.developer = developer;
        this.auth = auth;
        this.activity = activity;
    }
    async overview(authorization, req, res) {
        const session = await this.session(authorization, res);
        if (!session)
            return;
        const result = await this.developer.overview(session.sub);
        await this.activity.record({ session, action: "VIEW_DEVELOPER_OVERVIEW", targetType: "Developer", metadata: { keys: result.keys.length }, req });
        return result;
    }
    async updateKey(id, dto, authorization, res) {
        const session = await this.session(authorization, res);
        return session ? this.developer.updateKey(session, id, dto) : undefined;
    }
    async rotate(id, dto, authorization, req, res) {
        const session = await this.session(authorization, res);
        return session ? this.developer.rotate(session, id, dto.password, dto.grace_minutes, req) : undefined;
    }
    async revoke(id, authorization, req, res) {
        const session = await this.session(authorization, res);
        return session ? this.developer.revoke(session, id, req) : undefined;
    }
    async suspend(id, dto, authorization, req, res) {
        const session = await this.session(authorization, res);
        return session ? this.developer.suspend(session, id, dto.until, req) : undefined;
    }
    async resume(id, authorization, req, res) {
        const session = await this.session(authorization, res);
        return session ? this.developer.resume(session, id, req) : undefined;
    }
    async testKey(id, authorization, res) {
        const session = await this.session(authorization, res);
        return session ? this.developer.createTestKey(session, id) : undefined;
    }
    async createKey(id, dto, authorization, res) {
        const session = await this.session(authorization, res);
        return session ? this.developer.createKey(session, id, dto.scopes) : undefined;
    }
    async settings(id, dto, authorization, res) {
        const session = await this.session(authorization, res);
        return session ? this.developer.updateSettings(session, id, dto) : undefined;
    }
    async secret(id, dto, authorization, req, res) {
        const session = await this.session(authorization, res);
        return session ? this.developer.rotateSecret(session, id, dto.kind, dto.password, req) : undefined;
    }
    async secrets(id, dto, authorization, req, res) {
        const session = await this.session(authorization, res);
        return session ? this.developer.revealSecrets(session, id, dto.password, req) : undefined;
    }
    async plan(id, dto, authorization, res) {
        const session = await this.session(authorization, res);
        return session ? this.developer.changePlan(session, id, dto) : undefined;
    }
    async analytics(query, authorization, res) {
        const session = await this.session(authorization, res);
        return session ? this.developer.analytics(session.sub, query) : undefined;
    }
    async audit(query, authorization, res) {
        const session = await this.session(authorization, res);
        return session ? this.developer.audit(session.sub, query) : undefined;
    }
    async auditExport(query, authorization, res) {
        const session = await this.session(authorization, res);
        if (!session)
            return;
        const csv = await this.developer.auditCsv(session.sub, query);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", "attachment; filename=smartqr-audit.csv");
        return res.send(csv);
    }
    async securityEvents(query, authorization, res) {
        const session = await this.session(authorization, res);
        return session ? this.developer.securityEvents(session.sub, query) : undefined;
    }
    async webhooks(page, authorization, res) {
        const session = await this.session(authorization, res);
        return session ? this.developer.webhooks(session.sub, Math.max(1, Number(page || 1))) : undefined;
    }
    async retryWebhook(id, authorization, res) {
        const session = await this.session(authorization, res);
        return session ? this.developer.retryWebhook(session, id) : undefined;
    }
    async session(authorization, res) {
        const session = await this.auth.sessionFromAuthorization(authorization);
        if (!session)
            throw new common_1.UnauthorizedException("Login required");
        if (session.role === "ADMIN") {
            res.status(204).send();
            return null;
        }
        return session;
    }
};
exports.DeveloperController = DeveloperController;
__decorate([
    (0, common_1.Get)("overview"),
    __param(0, (0, common_1.Headers)("authorization")),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], DeveloperController.prototype, "overview", null);
__decorate([
    (0, common_1.Patch)("keys/:id"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)("authorization")),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, developer_dto_1.DeveloperUpdateKeyDto, Object, Object]),
    __metadata("design:returntype", Promise)
], DeveloperController.prototype, "updateKey", null);
__decorate([
    (0, common_1.Post)("keys/:id/rotate"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)("authorization")),
    __param(3, (0, common_1.Req)()),
    __param(4, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, developer_dto_1.DeveloperRotateKeyDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], DeveloperController.prototype, "rotate", null);
__decorate([
    (0, common_1.Post)("keys/:id/revoke"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Headers)("authorization")),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], DeveloperController.prototype, "revoke", null);
__decorate([
    (0, common_1.Post)("keys/:id/suspend"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)("authorization")),
    __param(3, (0, common_1.Req)()),
    __param(4, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], DeveloperController.prototype, "suspend", null);
__decorate([
    (0, common_1.Post)("keys/:id/resume"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Headers)("authorization")),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], DeveloperController.prototype, "resume", null);
__decorate([
    (0, common_1.Post)("rentals/:id/test-key"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Headers)("authorization")),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], DeveloperController.prototype, "testKey", null);
__decorate([
    (0, common_1.Post)("rentals/:id/keys"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)("authorization")),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, developer_dto_1.DeveloperCreateKeyDto, Object, Object]),
    __metadata("design:returntype", Promise)
], DeveloperController.prototype, "createKey", null);
__decorate([
    (0, common_1.Patch)("rentals/:id/settings"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)("authorization")),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, developer_dto_1.DeveloperRentalSettingsDto, Object, Object]),
    __metadata("design:returntype", Promise)
], DeveloperController.prototype, "settings", null);
__decorate([
    (0, common_1.Post)("rentals/:id/secrets"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)("authorization")),
    __param(3, (0, common_1.Req)()),
    __param(4, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, developer_dto_1.DeveloperSecretDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], DeveloperController.prototype, "secret", null);
__decorate([
    (0, common_1.Post)("rentals/:id/secrets/reveal"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)("authorization")),
    __param(3, (0, common_1.Req)()),
    __param(4, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], DeveloperController.prototype, "secrets", null);
__decorate([
    (0, common_1.Patch)("rentals/:id/plan"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)("authorization")),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, developer_dto_1.DeveloperPlanDto, Object, Object]),
    __metadata("design:returntype", Promise)
], DeveloperController.prototype, "plan", null);
__decorate([
    (0, common_1.Get)("analytics"),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Headers)("authorization")),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [developer_dto_1.DeveloperAnalyticsQueryDto, Object, Object]),
    __metadata("design:returntype", Promise)
], DeveloperController.prototype, "analytics", null);
__decorate([
    (0, common_1.Get)("audit"),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Headers)("authorization")),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [developer_dto_1.DeveloperAuditQueryDto, Object, Object]),
    __metadata("design:returntype", Promise)
], DeveloperController.prototype, "audit", null);
__decorate([
    (0, common_1.Get)("audit/export"),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Headers)("authorization")),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [developer_dto_1.DeveloperAuditQueryDto, Object, Object]),
    __metadata("design:returntype", Promise)
], DeveloperController.prototype, "auditExport", null);
__decorate([
    (0, common_1.Get)("security-events"),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Headers)("authorization")),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], DeveloperController.prototype, "securityEvents", null);
__decorate([
    (0, common_1.Get)("webhooks"),
    __param(0, (0, common_1.Query)("page")),
    __param(1, (0, common_1.Headers)("authorization")),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], DeveloperController.prototype, "webhooks", null);
__decorate([
    (0, common_1.Post)("webhooks/:id/retry"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Headers)("authorization")),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], DeveloperController.prototype, "retryWebhook", null);
exports.DeveloperController = DeveloperController = __decorate([
    (0, common_1.Controller)("api/v1/developer"),
    __metadata("design:paramtypes", [developer_service_1.DeveloperService, auth_service_1.AuthService, activity_log_service_1.ActivityLogService])
], DeveloperController);
