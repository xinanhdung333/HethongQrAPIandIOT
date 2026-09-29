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
exports.AccountSettingsController = void 0;
const common_1 = require("@nestjs/common");
const settings_payment_dto_1 = require("../settings-payment.dto");
const auth_service_1 = require("../security/auth.service");
const account_settings_service_1 = require("../services/account-settings.service");
let AccountSettingsController = class AccountSettingsController {
    auth;
    account;
    constructor(auth, account) {
        this.auth = auth;
        this.account = account;
    }
    async settings(authorization) {
        const session = await this.session(authorization);
        return this.account.profile(session);
    }
    async avatar(dto, authorization) {
        const session = await this.session(authorization);
        return this.account.uploadAvatar(session, dto);
    }
    async createPayout(dto, authorization) {
        const session = await this.session(authorization);
        return this.account.createPayoutAccount(session, dto);
    }
    async updatePayout(id, dto, authorization) {
        const session = await this.session(authorization);
        return this.account.updatePayoutAccount(session, id, dto);
    }
    async makeDefault(id, authorization) {
        const session = await this.session(authorization);
        return this.account.setDefault(session, id);
    }
    async reveal(id, dto, authorization) {
        const session = await this.session(authorization);
        return this.account.revealPayoutAccount(session, id, dto.password);
    }
    async remove(id, authorization, res) {
        const session = await this.session(authorization);
        const result = await this.account.deletePayoutAccount(session, id);
        res?.status(200);
        return result;
    }
    async session(authorization) {
        const session = await this.auth.sessionFromAuthorization(authorization);
        if (!session)
            throw new common_1.UnauthorizedException({ error: "unauthorized", message: "Login required" });
        return session;
    }
};
exports.AccountSettingsController = AccountSettingsController;
__decorate([
    (0, common_1.Get)("settings"),
    __param(0, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AccountSettingsController.prototype, "settings", null);
__decorate([
    (0, common_1.Post)("avatar"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [settings_payment_dto_1.AvatarUploadDto, String]),
    __metadata("design:returntype", Promise)
], AccountSettingsController.prototype, "avatar", null);
__decorate([
    (0, common_1.Post)("payout-accounts"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [settings_payment_dto_1.PayoutAccountDto, String]),
    __metadata("design:returntype", Promise)
], AccountSettingsController.prototype, "createPayout", null);
__decorate([
    (0, common_1.Patch)("payout-accounts/:id"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], AccountSettingsController.prototype, "updatePayout", null);
__decorate([
    (0, common_1.Post)("payout-accounts/:id/default"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AccountSettingsController.prototype, "makeDefault", null);
__decorate([
    (0, common_1.Post)("payout-accounts/:id/reveal"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)("authorization")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, settings_payment_dto_1.PasswordDto, String]),
    __metadata("design:returntype", Promise)
], AccountSettingsController.prototype, "reveal", null);
__decorate([
    (0, common_1.Delete)("payout-accounts/:id"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Headers)("authorization")),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], AccountSettingsController.prototype, "remove", null);
exports.AccountSettingsController = AccountSettingsController = __decorate([
    (0, common_1.Controller)("api/v1/account"),
    __metadata("design:paramtypes", [auth_service_1.AuthService, account_settings_service_1.AccountSettingsService])
], AccountSettingsController);
