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
exports.DashboardController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../security/auth.service");
const activity_log_service_1 = require("../services/activity-log.service");
const platform_service_1 = require("../services/platform.service");
let DashboardController = class DashboardController {
    platform;
    auth;
    activity;
    constructor(platform, auth, activity) {
        this.platform = platform;
        this.auth = auth;
        this.activity = activity;
    }
    async dashboard(authorization, req) {
        const session = await this.auth.sessionFromAuthorization(authorization);
        if (!session) {
            throw new common_1.UnauthorizedException("Login required");
        }
        const data = await this.platform.dashboard(session.sub);
        await this.activity.record({ session, action: "VIEW_DASHBOARD", targetType: "Dashboard", metadata: { rentals: data.rentals.length, shows: data.shows.length }, req });
        return data;
    }
};
exports.DashboardController = DashboardController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Headers)("authorization")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "dashboard", null);
exports.DashboardController = DashboardController = __decorate([
    (0, common_1.Controller)("dashboard"),
    __metadata("design:paramtypes", [platform_service_1.PlatformService, auth_service_1.AuthService, activity_log_service_1.ActivityLogService])
], DashboardController);
