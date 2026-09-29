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
exports.ShowsController = void 0;
const common_1 = require("@nestjs/common");
const dto_1 = require("../dto");
const auth_service_1 = require("../security/auth.service");
const activity_log_service_1 = require("../services/activity-log.service");
const platform_service_1 = require("../services/platform.service");
let ShowsController = class ShowsController {
    platform;
    auth;
    activity;
    constructor(platform, auth, activity) {
        this.platform = platform;
        this.auth = auth;
        this.activity = activity;
    }
    async create(dto, authorization, req, res) {
        const session = await this.allowCustomerOnly(authorization, res);
        if (!session)
            return;
        const result = await this.platform.createShow(dto, session.sub);
        await this.activity.record({
            session,
            action: "CREATE_SHOW",
            targetType: "Show",
            targetId: result.show_id,
            metadata: { name: dto.name, location: dto.location, ticket_price: dto.ticket_price, total_tickets: dto.total_tickets },
            req
        });
        return result;
    }
    async end(id, authorization, req, res) {
        const session = await this.allowCustomerOnly(authorization, res);
        if (!session)
            return;
        const result = await this.platform.endShow(id, session.sub);
        await this.activity.record({ session, action: "END_SHOW", targetType: "Show", targetId: id, metadata: { status: result?.status }, req });
        return result;
    }
    show(slug) {
        return this.platform.getShow(slug);
    }
    buy(slug, dto) {
        return this.platform.buyTickets(slug, dto);
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
exports.ShowsController = ShowsController;
__decorate([
    (0, common_1.Post)("shows"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)("authorization")),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.ShowDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ShowsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)("shows/:id/end"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Headers)("authorization")),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ShowsController.prototype, "end", null);
__decorate([
    (0, common_1.Get)("e/:slug"),
    __param(0, (0, common_1.Param)("slug")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ShowsController.prototype, "show", null);
__decorate([
    (0, common_1.Post)("e/:slug/buy"),
    __param(0, (0, common_1.Param)("slug")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.BuyTicketDto]),
    __metadata("design:returntype", void 0)
], ShowsController.prototype, "buy", null);
exports.ShowsController = ShowsController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [platform_service_1.PlatformService, auth_service_1.AuthService, activity_log_service_1.ActivityLogService])
], ShowsController);
