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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiKeyGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const auth_service_1 = require("./auth.service");
const api_key_decorator_1 = require("./api-key.decorator");
const api_rate_limit_service_1 = require("../services/api-rate-limit.service");
const system_settings_service_1 = require("../services/system-settings.service");
const api_security_1 = require("./api-security");
const secret_box_1 = require("./secret-box");
let ApiKeyGuard = class ApiKeyGuard {
    reflector;
    auth;
    rate;
    settings;
    constructor(reflector, auth, rate, settings) {
        this.reflector = reflector;
        this.auth = auth;
        this.rate = rate;
        this.settings = settings;
    }
    async canActivate(context) {
        const required = this.reflector.getAllAndOverride(api_key_decorator_1.REQUIRE_API_KEY, [
            context.getHandler(),
            context.getClass()
        ]);
        const requiredScope = this.reflector.getAllAndOverride(api_key_decorator_1.API_KEY_SCOPE, [
            context.getHandler(),
            context.getClass()
        ]);
        if (!required)
            return true;
        const request = context.switchToHttp().getRequest();
        const demoScan = request.headers["x-demo-scan"] === "true" && process.env.NODE_ENV !== "production" && !request.headers["x-api-key"] && request.originalUrl.split("?")[0] === "/api/v1/tickets/verify";
        if (demoScan)
            return true;
        const raw = request.headers["x-api-key"];
        if (!raw || Array.isArray(raw) || typeof raw !== "string")
            throw new common_1.UnauthorizedException("Missing API key");
        const key = await this.auth.getApiKey(raw);
        if (!key)
            throw new common_1.UnauthorizedException("Invalid API key");
        request.apiKey = key;
        if (!(0, api_security_1.ipAllowed)(request.ip ?? "", key.allowedIps))
            throw new common_1.ForbiddenException({ error: "ip_not_allowed", message: "Request IP is not allowed for this API key" });
        if (request.headers["x-api-explorer"] === "true") {
            const platform = await this.settings.apiPlatform();
            if (!platform.feature_flags.api_explorer)
                throw new common_1.ForbiddenException({ error: "feature_disabled", message: "API Explorer is disabled by admin settings" });
            if (!key.isTest)
                throw new common_1.ForbiddenException({ error: "test_key_required", message: "API Explorer requires a test key" });
        }
        if (key.rental?.signingEnabled) {
            if (!key.rental.signingSecret)
                throw new common_1.ServiceUnavailableException({ error: "signing_unavailable", message: "Request signing is not configured" });
            (0, api_security_1.verifyRequestSignature)((0, secret_box_1.openSecret)(key.rental.signingSecret), request.headers["x-timestamp"], request.headers["x-signature"], request.method, request.originalUrl, request.rawBody ?? Buffer.alloc(0));
        }
        if (requiredScope && !this.auth.apiKeyHasScope(key.scopes, requiredScope)) {
            throw new common_1.ForbiddenException({
                error: "forbidden_scope",
                message: `API key does not have '${requiredScope}' permission`
            });
        }
        const response = context.switchToHttp().getResponse();
        let rate;
        try {
            rate = await this.rate.consume(key.id, key.rateLimit);
        }
        catch {
            throw new common_1.ServiceUnavailableException({ error: "rate_limit_unavailable", message: "Rate limit store unavailable; retry shortly" });
        }
        response.setHeader("X-RateLimit-Limit", rate.limit);
        response.setHeader("X-RateLimit-Remaining", rate.remaining);
        response.setHeader("X-RateLimit-Reset", rate.reset);
        if (!rate.allowed) {
            response.setHeader("Retry-After", Math.max(1, rate.reset - Math.floor(Date.now() / 1000)));
            throw new common_1.HttpException({ error: "rate_limited", message: "API key rate limit exceeded" }, 429);
        }
        return true;
    }
};
exports.ApiKeyGuard = ApiKeyGuard;
exports.ApiKeyGuard = ApiKeyGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector, auth_service_1.AuthService, api_rate_limit_service_1.ApiRateLimitService, system_settings_service_1.SystemSettingsService])
], ApiKeyGuard);
