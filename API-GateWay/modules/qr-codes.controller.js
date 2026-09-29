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
exports.QrCodesController = void 0;
const common_1 = require("@nestjs/common");
const api_qr_dto_1 = require("../api-qr.dto");
const api_key_decorator_1 = require("../security/api-key.decorator");
const qr_platform_service_1 = require("../services/qr-platform.service");
let QrCodesController = class QrCodesController {
    platform;
    constructor(platform) {
        this.platform = platform;
    }
    create(dto, apiKey, idempotencyKey) {
        return this.forward("POST", "", apiKey, dto, idempotencyKey);
    }
    bulk(dto, apiKey, idempotencyKey) {
        return this.forward("POST", "/bulk", apiKey, dto, idempotencyKey);
    }
    get(id, headerApiKey) {
        return this.forward("GET", `/${encodeURIComponent(id)}`, headerApiKey);
    }
    revoke(id, headerApiKey, idempotencyKey) {
        return this.forward("POST", `/${encodeURIComponent(id)}/revoke`, headerApiKey, undefined, idempotencyKey);
    }
    async svg(id, headerApiKey, res) {
        const base = process.env.QR_SERVICE_URL ?? "http://localhost:3005";
        let response;
        try {
            response = await fetch(`${base}/api/v1/qr-codes/${encodeURIComponent(id)}/svg`, {
                headers: { "x-api-key": headerApiKey ?? "" },
                signal: AbortSignal.timeout(5000)
            });
        }
        catch (error) {
            throw new common_1.ServiceUnavailableException({ error: "qr_service_unavailable", message: "QR service is unavailable" }, { cause: error instanceof Error ? error : undefined });
        }
        if (!response.ok) {
            const payload = await response.json().catch(() => ({ error: "qr_service_error", message: "QR service request failed" }));
            throw new common_1.HttpException(payload, response.status);
        }
        const svg = await response.text();
        res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
        res.setHeader("Cache-Control", "private, no-store");
        return res.send(svg);
    }
    async forward(method, path, apiKey, body, idempotencyKey) {
        const base = process.env.QR_SERVICE_URL ?? "http://localhost:3005";
        try {
            const response = await fetch(`${base}/api/v1/qr-codes${path}`, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey ?? "",
                    ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {})
                },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
                signal: AbortSignal.timeout(5000)
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok)
                throw new common_1.HttpException(payload ?? { error: "qr_service_error", message: "QR service request failed" }, response.status);
            return payload;
        }
        catch (error) {
            if (error instanceof common_1.HttpException)
                throw error;
            throw new common_1.ServiceUnavailableException({ error: "qr_service_unavailable", message: "QR service is unavailable" });
        }
    }
};
exports.QrCodesController = QrCodesController;
__decorate([
    (0, common_1.Post)(),
    (0, api_key_decorator_1.RequireApiKey)("qr:create"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)("x-api-key")),
    __param(2, (0, common_1.Headers)("idempotency-key")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [api_qr_dto_1.ApiCreateQrDto, String, String]),
    __metadata("design:returntype", void 0)
], QrCodesController.prototype, "create", null);
__decorate([
    (0, common_1.Post)("bulk"),
    (0, api_key_decorator_1.RequireApiKey)("qr:create"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)("x-api-key")),
    __param(2, (0, common_1.Headers)("idempotency-key")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [api_qr_dto_1.ApiBulkCreateQrDto, String, String]),
    __metadata("design:returntype", void 0)
], QrCodesController.prototype, "bulk", null);
__decorate([
    (0, common_1.Get)(":id"),
    (0, api_key_decorator_1.RequireApiKey)("qr:read"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Headers)("x-api-key")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], QrCodesController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(":id/revoke"),
    (0, api_key_decorator_1.RequireApiKey)("qr:create"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Headers)("x-api-key")),
    __param(2, (0, common_1.Headers)("idempotency-key")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", void 0)
], QrCodesController.prototype, "revoke", null);
__decorate([
    (0, common_1.Get)(":id/svg"),
    (0, api_key_decorator_1.RequireApiKey)("qr:read"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Headers)("x-api-key")),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], QrCodesController.prototype, "svg", null);
exports.QrCodesController = QrCodesController = __decorate([
    (0, common_1.Controller)("api/v1/qr-codes"),
    __metadata("design:paramtypes", [qr_platform_service_1.QrPlatformService])
], QrCodesController);
