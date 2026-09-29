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
exports.SecurityController = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
let SecurityController = class SecurityController {
    csrfToken(request, response) {
        const rawExisting = request.headers.cookie?.split(";")
            .map((part) => part.trim())
            .find((part) => part.startsWith("csrf_token="))
            ?.slice("csrf_token=".length);
        const existing = rawExisting ? decodeCookie(rawExisting) : undefined;
        const token = existing && /^[a-f0-9]{64}$/i.test(existing)
            ? existing
            : (0, crypto_1.randomBytes)(32).toString("hex");
        if (token !== existing)
            response.cookie("csrf_token", token, {
                httpOnly: false,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
                path: "/"
            });
        return { token };
    }
};
exports.SecurityController = SecurityController;
__decorate([
    (0, common_1.Get)("csrf-token"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SecurityController.prototype, "csrfToken", null);
exports.SecurityController = SecurityController = __decorate([
    (0, common_1.Controller)("api")
], SecurityController);
function decodeCookie(value) {
    try {
        return decodeURIComponent(value);
    }
    catch {
        return undefined;
    }
}
