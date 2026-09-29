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
exports.TicketsController = void 0;
const common_1 = require("@nestjs/common");
const api_qr_dto_1 = require("../api-qr.dto");
const platform_service_1 = require("../services/platform.service");
const qr_platform_service_1 = require("../services/qr-platform.service");
const api_key_decorator_1 = require("../security/api-key.decorator");
let TicketsController = class TicketsController {
    platform;
    qrPlatform;
    constructor(platform, qrPlatform) {
        this.platform = platform;
        this.qrPlatform = qrPlatform;
    }
    async verify(dto, apiKey, idempotencyKey, req) {
        // Legacy direct-ticket logic kept here as rollback reference:
        // const userAgent = req.headers["user-agent"];
        // const result = await this.qrPlatform.verifyExternal(dto, apiKey, { ip: req.ip, userAgent: Array.isArray(userAgent) ? userAgent.join(", ") : userAgent }, idempotencyKey, true);
        // if (result) return result;
        // return this.platform.verifyTicket(dto, apiKey, { ip: req.ip, userAgent: Array.isArray(userAgent) ? userAgent.join(", ") : userAgent });
        const userAgent = req.headers["user-agent"];
        const ticketServiceUrl = process.env.TICKET_SERVICE_URL ?? "http://localhost:3003";
        let response;
        try {
            response = await fetch(`${ticketServiceUrl}/api/v1/tickets/verify`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey ?? "",
                    ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
                    "user-agent": Array.isArray(userAgent) ? userAgent.join(", ") : userAgent ?? ""
                },
                body: JSON.stringify(dto),
                signal: AbortSignal.timeout(5000)
            });
        }
        catch (error) {
            throw new common_1.ServiceUnavailableException({
                error: "ticket_service_unavailable",
                message: "Ticket service is unavailable"
            }, { cause: error instanceof Error ? error : undefined });
        }
        if (!response.ok) {
            const payload = await response.json().catch(() => ({ error: "ticket_service_unavailable", message: "Ticket service is unavailable" }));
            throw new common_1.HttpException({
                error: payload?.error ?? "ticket_service_unavailable",
                message: payload?.message ?? "Ticket service is unavailable"
            }, response.status || 503);
        }
        return response.json();
    }
    revoke(id, apiKey) {
        return this.platform.revokeTicket(id, apiKey);
    }
};
exports.TicketsController = TicketsController;
__decorate([
    (0, common_1.Post)("verify"),
    (0, api_key_decorator_1.RequireApiKey)("ticket:verify"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)("x-api-key")),
    __param(2, (0, common_1.Headers)("idempotency-key")),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [api_qr_dto_1.ApiVerifyQrDto, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], TicketsController.prototype, "verify", null);
__decorate([
    (0, common_1.Post)(":id/revoke"),
    (0, api_key_decorator_1.RequireApiKey)("qr:create"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Headers)("x-api-key")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TicketsController.prototype, "revoke", null);
exports.TicketsController = TicketsController = __decorate([
    (0, common_1.Controller)("api/v1/tickets"),
    __metadata("design:paramtypes", [platform_service_1.PlatformService, qr_platform_service_1.QrPlatformService])
], TicketsController);
