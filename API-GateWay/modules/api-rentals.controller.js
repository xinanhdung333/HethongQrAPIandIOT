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
exports.ApiRentalsController = void 0;
const common_1 = require("@nestjs/common");
const dto_1 = require("../dto");
const auth_service_1 = require("../security/auth.service");
const activity_log_service_1 = require("../services/activity-log.service");
const platform_service_1 = require("../services/platform.service");
let ApiRentalsController = class ApiRentalsController {
    platform;
    auth;
    activity;
    constructor(platform, auth, activity) {
        this.platform = platform;
        this.auth = auth;
        this.activity = activity;
    }
    async list(authorization, req, res) {
        const session = await this.allowCustomerOnly(authorization, res);
        if (!session)
            return;
        const orders = await this.forward("GET", "/api-rentals", session.sub);
        await this.activity.record({ session, action: "LIST_API_RENTALS", targetType: "ApiRentalOrder", metadata: { count: orders.length }, req });
        return orders;
    }
    async create(dto, authorization, req, res) {
        const session = await this.allowCustomerOnly(authorization, res);
        if (!session)
            return;
        const result = await this.forward("POST", "/api-rentals", session.sub, dto);
        await this.activity.record({
            session,
            action: "CREATE_API_RENTAL",
            targetType: "ApiRentalOrder",
            targetId: result.order_id,
            metadata: { app_name: dto.app_name, plan: dto.plan, duration: dto.duration, total: result.breakdown.total },
            req
        });
        return result;
    }
    async forward(method, path, userId, body) {
        const base = process.env.RENTAL_SERVICE_URL ?? "http://localhost:3004";
        try {
            const response = await fetch(`${base}${path}`, {
                method,
                headers: { "Content-Type": "application/json", "x-user-id": userId },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
                signal: AbortSignal.timeout(5000)
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new common_1.HttpException(payload ?? { error: "rental_service_error", message: "Rental service request failed" }, response.status);
            }
            return payload;
        }
        catch (error) {
            if (error instanceof common_1.HttpException)
                throw error;
            throw new common_1.ServiceUnavailableException({ error: "rental_service_unavailable", message: "Rental service is unavailable" });
        }
    }
    async updateKeyScopes(id, dto, authorization, req, res) {
        const session = await this.allowCustomerOnly(authorization, res);
        if (!session)
            return;
        const result = await this.platform.updateApiKeyScopes(id, session.sub, dto);
        await this.activity.record({
            session,
            action: "UPDATE_API_KEY_SCOPES",
            targetType: "ApiKey",
            targetId: id,
            metadata: { scopes: dto.scopes },
            req
        });
        return result;
    }
    async allowCustomerOnly(authorization, res) {
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
exports.ApiRentalsController = ApiRentalsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Headers)("authorization")),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ApiRentalsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)("authorization")),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.ApiRentalDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ApiRentalsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)("api-keys/:id/scopes"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)("authorization")),
    __param(3, (0, common_1.Req)()),
    __param(4, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.UpdateApiKeyScopesDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ApiRentalsController.prototype, "updateKeyScopes", null);
exports.ApiRentalsController = ApiRentalsController = __decorate([
    (0, common_1.Controller)("api-rentals"),
    __metadata("design:paramtypes", [platform_service_1.PlatformService, auth_service_1.AuthService, activity_log_service_1.ActivityLogService])
], ApiRentalsController);
