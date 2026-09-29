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
exports.RentalsController = void 0;
const common_1 = require("@nestjs/common");
const dto_1 = require("../dto");
const auth_service_1 = require("../security/auth.service");
const activity_log_service_1 = require("../services/activity-log.service");
const platform_service_1 = require("../services/platform.service");
let RentalsController = class RentalsController {
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
        const rentals = await this.platform.listRentals(session.sub);
        await this.activity.record({ session, action: "LIST_RENTALS", targetType: "RentalOrder", metadata: { count: rentals.length }, req });
        return rentals;
    }
    async detail(id, authorization, req, res) {
        const session = await this.allowCustomerOnly(authorization, res);
        if (!session)
            return;
        const rental = await this.platform.getRental(id, session.sub);
        await this.activity.record({ session, action: "VIEW_RENTAL", targetType: "RentalOrder", targetId: id, req });
        return rental;
    }
    async create(dto, authorization, req, res) {
        const session = await this.allowCustomerOnly(authorization, res);
        if (!session)
            return;
        const result = await this.platform.createRental(dto, session.sub);
        await this.activity.record({
            session,
            action: dto.type === "rent" ? "CREATE_RENTAL" : "BUY_PRODUCT",
            targetType: "RentalOrder",
            targetId: result.order_id,
            metadata: { product_id: dto.product_id, type: dto.type, quantity: dto.quantity, duration: dto.duration, total: result.breakdown.total },
            req
        });
        return result;
    }
    async returnOrder(id, authorization, req, res) {
        const session = await this.allowCustomerOnly(authorization, res);
        if (!session)
            return;
        const result = await this.platform.returnRental(id, session.sub);
        await this.activity.record({ session, action: "RETURN_RENTAL", targetType: "RentalOrder", targetId: id, metadata: { status: result?.status }, req });
        return result;
    }
    async allowCustomerOnly(authorization, res) {
        const session = await this.auth.sessionFromAuthorization(authorization);
        if (!session) {
            throw new common_1.UnauthorizedException("Login required");
        }
        if (session.role === "ADMIN") {
            res.status(204).send();
            return null;
        }
        return session;
    }
};
exports.RentalsController = RentalsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Headers)("authorization")),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], RentalsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(":id"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Headers)("authorization")),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], RentalsController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)("authorization")),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.RentalDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], RentalsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(":id/return"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Headers)("authorization")),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], RentalsController.prototype, "returnOrder", null);
exports.RentalsController = RentalsController = __decorate([
    (0, common_1.Controller)("rentals"),
    __metadata("design:paramtypes", [platform_service_1.PlatformService, auth_service_1.AuthService, activity_log_service_1.ActivityLogService])
], RentalsController);
