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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const dto_1 = require("../dto");
const activity_log_service_1 = require("../services/activity-log.service");
const platform_service_1 = require("../services/platform.service");
let AuthController = class AuthController {
    platform;
    activity;
    constructor(platform, activity) {
        this.platform = platform;
        this.activity = activity;
    }
    async register(dto, req) {
        const result = await this.platform.register(dto);
        await this.activity.record({ session: { sub: result.user.id, email: result.user.email, role: result.user.role, jti: "" }, action: "REGISTER", targetType: "User", targetId: result.user.id, req });
        return result;
    }
    async login(dto, req) {
        const result = await this.platform.login(dto);
        await this.activity.record({ session: { sub: result.user.id, email: result.user.email, role: result.user.role, jti: "" }, action: "LOGIN", targetType: "User", targetId: result.user.id, req });
        return result;
    }
    me(authorization) {
        const token = authorization?.replace(/^Bearer\s+/i, "");
        if (!token)
            throw new common_1.UnauthorizedException("Missing token");
        return this.platform.me(token);
    }
    async updateProfile(dto, authorization, req) {
        const token = authorization?.replace(/^Bearer\s+/i, "");
        if (!token)
            throw new common_1.UnauthorizedException("Missing token");
        const session = await this.platform.me(token).then((value) => ({ sub: value.user.id, email: value.user.email, role: value.user.role, jti: "" }));
        const result = await this.platform.updateProfile(session.sub, dto);
        await this.activity.record({ session, action: "UPDATE_PROFILE", targetType: "User", targetId: session.sub, metadata: { email_changed: Boolean(dto.email) }, req });
        return result;
    }
    async logout(authorization, req) {
        const token = authorization?.replace(/^Bearer\s+/i, "");
        if (!token)
            throw new common_1.UnauthorizedException("Missing token");
        const session = await this.platform.me(token).then((value) => ({ sub: value.user.id, email: value.user.email, role: value.user.role, jti: "" }));
        const result = await this.platform.logout(token);
        await this.activity.record({ session, action: "LOGOUT", targetType: "User", targetId: session.sub, req });
        return result;
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)("register"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.RegisterDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, common_1.Post)("login"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.LoginDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Get)("me"),
    __param(0, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "me", null);
__decorate([
    (0, common_1.Patch)("profile"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)("authorization")),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.UpdateProfileDto, String, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Post)("logout"),
    __param(0, (0, common_1.Headers)("authorization")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)("auth"),
    __metadata("design:paramtypes", [platform_service_1.PlatformService, activity_log_service_1.ActivityLogService])
], AuthController);
