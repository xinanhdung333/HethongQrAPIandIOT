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
exports.AdminSettingsPaymentsController = exports.DeveloperPaymentsController = exports.PaymentsController = void 0;
const common_1 = require("@nestjs/common");
const settings_payment_dto_1 = require("../settings-payment.dto");
const api_key_decorator_1 = require("../security/api-key.decorator");
const auth_service_1 = require("../security/auth.service");
const account_settings_service_1 = require("../services/account-settings.service");
const activity_log_service_1 = require("../services/activity-log.service");
const payment_transactions_service_1 = require("../services/payment-transactions.service");
const prisma_service_1 = require("../services/prisma.service");
const system_settings_service_1 = require("../services/system-settings.service");
let PaymentsController = class PaymentsController {
    payments;
    constructor(payments) {
        this.payments = payments;
    }
    create(dto, apiKey, idempotencyKey) {
        return this.payments.create(dto, apiKey, idempotencyKey);
    }
};
exports.PaymentsController = PaymentsController;
__decorate([
    (0, common_1.Post)(),
    (0, api_key_decorator_1.RequireApiKey)("ticket:verify"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)("x-api-key")),
    __param(2, (0, common_1.Headers)("idempotency-key")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [settings_payment_dto_1.PaymentCreateDto, String, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "create", null);
exports.PaymentsController = PaymentsController = __decorate([
    (0, common_1.Controller)("api/v1/payments"),
    __metadata("design:paramtypes", [payment_transactions_service_1.PaymentTransactionsService])
], PaymentsController);
let DeveloperPaymentsController = class DeveloperPaymentsController {
    payments;
    auth;
    constructor(payments, auth) {
        this.payments = payments;
        this.auth = auth;
    }
    async list(query, authorization) {
        const session = await this.session(authorization);
        return this.payments.developerPayments(session.sub, query);
    }
    async session(authorization) {
        const session = await this.auth.sessionFromAuthorization(authorization);
        if (!session)
            throw new common_1.UnauthorizedException({ error: "unauthorized", message: "Login required" });
        return session;
    }
};
exports.DeveloperPaymentsController = DeveloperPaymentsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [settings_payment_dto_1.PaymentQueryDto, String]),
    __metadata("design:returntype", Promise)
], DeveloperPaymentsController.prototype, "list", null);
exports.DeveloperPaymentsController = DeveloperPaymentsController = __decorate([
    (0, common_1.Controller)("api/v1/developer/payments"),
    __metadata("design:paramtypes", [payment_transactions_service_1.PaymentTransactionsService, auth_service_1.AuthService])
], DeveloperPaymentsController);
let AdminSettingsPaymentsController = class AdminSettingsPaymentsController {
    auth;
    prisma;
    settings;
    payments;
    account;
    activity;
    constructor(auth, prisma, settings, payments, account, activity) {
        this.auth = auth;
        this.prisma = prisma;
        this.settings = settings;
        this.payments = payments;
        this.account = account;
        this.activity = activity;
    }
    async getSettings(authorization) {
        await this.assertAdmin(authorization);
        return { api_platform: await this.settings.apiPlatform() };
    }
    async updateSettings(dto, authorization, req) {
        const session = await this.assertAdmin(authorization);
        const result = await this.settings.updateApiPlatform(dto, session.sub);
        await this.activity.record({ session, action: "UPDATE_SYSTEM_SETTINGS", targetType: "SystemSetting", targetId: "api_platform", metadata: result, req });
        if (JSON.stringify(result.before.quota_burst) !== JSON.stringify(result.after.quota_burst)) {
            await this.activity.record({
                session,
                action: "UPDATE_QUOTA_BURST_SETTINGS",
                targetType: "SystemSetting",
                targetId: "api_platform",
                metadata: { before: result.before.quota_burst, after: result.after.quota_burst },
                req
            });
        }
        return { api_platform: result.after, version: result.version };
    }
    async users(authorization) {
        await this.assertAdmin(authorization);
        return this.prisma.user.findMany({
            select: {
                id: true, email: true, role: true, avatarUrl: true, createdAt: true,
                apiRentals: { select: { id: true, appName: true, status: true, plan: true } },
                payoutAccounts: { where: { status: { not: "deleted" } }, select: { id: true, method: true, bankName: true, accountNumber: true, accountName: true, walletType: true, walletId: true, isDefault: true, status: true, userId: true, branch: true, createdAt: true, updatedAt: true } }
            },
            orderBy: { createdAt: "desc" }, take: 200
        }).then(users => users.map(user => ({ ...user, payoutAccounts: user.payoutAccounts.map(account => this.account.maskAccount(account)) })));
    }
    async revealPayout(id, authorization) {
        const session = await this.assertAdmin(authorization);
        return this.account.revealPayoutAccount(session, id);
    }
    async incidents(authorization) {
        await this.assertAdmin(authorization);
        const items = await this.prisma.apiIncident.findMany({ orderBy: { startedAt: "desc" }, take: 100 });
        return { items: items.map(item => this.publicIncident(item)) };
    }
    async createIncident(dto, authorization, req) {
        const session = await this.assertAdmin(authorization);
        const incident = await this.prisma.apiIncident.create({
            data: {
                title: dto.title.trim(),
                status: dto.status,
                startedAt: dto.started_at ? new Date(dto.started_at) : new Date(),
                resolvedAt: dto.resolved_at ? new Date(dto.resolved_at) : dto.status === "resolved" ? new Date() : null
            }
        });
        await this.activity.record({ session, action: "CREATE_API_INCIDENT", targetType: "ApiIncident", targetId: incident.id, metadata: this.publicIncident(incident), req });
        return { incident: this.publicIncident(incident) };
    }
    async updateIncident(id, dto, authorization, req) {
        const session = await this.assertAdmin(authorization);
        const incident = await this.prisma.apiIncident.update({
            where: { id },
            data: {
                title: dto.title?.trim(),
                status: dto.status,
                startedAt: dto.started_at ? new Date(dto.started_at) : undefined,
                resolvedAt: dto.resolved_at ? new Date(dto.resolved_at) : dto.status === "resolved" ? new Date() : dto.status ? null : undefined
            }
        });
        await this.activity.record({ session, action: "UPDATE_API_INCIDENT", targetType: "ApiIncident", targetId: incident.id, metadata: this.publicIncident(incident), req });
        return { incident: this.publicIncident(incident) };
    }
    async adminPayments(query, authorization) {
        await this.assertAdmin(authorization);
        return this.payments.adminPayments(query);
    }
    async updatePayment(id, dto, authorization) {
        const session = await this.assertAdmin(authorization);
        return this.payments.updateStatus(session, id, dto);
    }
    publicIncident(item) {
        return { id: item.id, title: item.title, status: item.status, started_at: item.startedAt.toISOString(), resolved_at: item.resolvedAt?.toISOString() ?? null };
    }
    async assertAdmin(authorization) {
        const session = await this.auth.sessionFromAuthorization(authorization);
        if (!session)
            throw new common_1.UnauthorizedException({ error: "unauthorized", message: "Login required" });
        if (session.role !== "ADMIN")
            throw new common_1.UnauthorizedException({ error: "admin_required", message: "Admin role required" });
        return session;
    }
};
exports.AdminSettingsPaymentsController = AdminSettingsPaymentsController;
__decorate([
    (0, common_1.Get)("settings"),
    __param(0, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminSettingsPaymentsController.prototype, "getSettings", null);
__decorate([
    (0, common_1.Patch)("settings"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)("authorization")),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [settings_payment_dto_1.AdminApiPlatformSettingsDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminSettingsPaymentsController.prototype, "updateSettings", null);
__decorate([
    (0, common_1.Get)("users"),
    __param(0, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminSettingsPaymentsController.prototype, "users", null);
__decorate([
    (0, common_1.Post)("payout-accounts/:id/reveal"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AdminSettingsPaymentsController.prototype, "revealPayout", null);
__decorate([
    (0, common_1.Get)("incidents"),
    __param(0, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminSettingsPaymentsController.prototype, "incidents", null);
__decorate([
    (0, common_1.Post)("incidents"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)("authorization")),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [settings_payment_dto_1.AdminIncidentDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminSettingsPaymentsController.prototype, "createIncident", null);
__decorate([
    (0, common_1.Patch)("incidents/:id"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)("authorization")),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminSettingsPaymentsController.prototype, "updateIncident", null);
__decorate([
    (0, common_1.Get)("payments"),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [settings_payment_dto_1.PaymentQueryDto, String]),
    __metadata("design:returntype", Promise)
], AdminSettingsPaymentsController.prototype, "adminPayments", null);
__decorate([
    (0, common_1.Patch)("payments/:id/status"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, settings_payment_dto_1.PaymentStatusDto, String]),
    __metadata("design:returntype", Promise)
], AdminSettingsPaymentsController.prototype, "updatePayment", null);
exports.AdminSettingsPaymentsController = AdminSettingsPaymentsController = __decorate([
    (0, common_1.Controller)("api/v1/admin"),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        prisma_service_1.PrismaService,
        system_settings_service_1.SystemSettingsService,
        payment_transactions_service_1.PaymentTransactionsService,
        account_settings_service_1.AccountSettingsService,
        activity_log_service_1.ActivityLogService])
], AdminSettingsPaymentsController);
