import { CanActivate, ExecutionContext, ForbiddenException, HttpException, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthService } from "./auth.service";
import { API_KEY_SCOPE, ApiKeyScope, REQUIRE_API_KEY } from "./api-key.decorator";
import { ApiRateLimitService } from "../services/api-rate-limit.service";
import { SystemSettingsService } from "../services/system-settings.service";
import { ipAllowed, verifyRequestSignature } from "./api-security";
import { openSecret } from "./secret-box";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly auth: AuthService, private readonly rate: ApiRateLimitService, private readonly settings: SystemSettingsService) {}

  async canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_API_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    const requiredScope = this.reflector.getAllAndOverride<ApiKeyScope | undefined>(API_KEY_SCOPE, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const demoScan = request.headers["x-demo-scan"] === "true" && process.env.NODE_ENV !== "production" && !request.headers["x-api-key"] && !request.query?.api_key && request.originalUrl.split("?")[0] === "/api/v1/tickets/verify";
    if (demoScan) return true;

    const raw = request.headers["x-api-key"] ?? request.query?.api_key;
    if (!raw || Array.isArray(raw) || typeof raw !== "string") throw new UnauthorizedException("Missing API key");
    const key = await this.auth.getApiKey(raw);
    if (!key) throw new UnauthorizedException("Invalid API key");
    request.apiKey = key;
    if (!ipAllowed(request.ip ?? "", key.allowedIps)) throw new ForbiddenException({ error: "ip_not_allowed", message: "Request IP is not allowed for this API key" });
    if (request.headers["x-api-explorer"] === "true") {
      const platform = await this.settings.apiPlatform();
      if (!platform.feature_flags.api_explorer) throw new ForbiddenException({ error: "feature_disabled", message: "API Explorer is disabled by admin settings" });
      if (!key.isTest) throw new ForbiddenException({ error: "test_key_required", message: "API Explorer requires a test key" });
    }
    if (key.rental?.signingEnabled) {
      if (!key.rental.signingSecret) throw new ServiceUnavailableException({ error: "signing_unavailable", message: "Request signing is not configured" });
      verifyRequestSignature(openSecret(key.rental.signingSecret), request.headers["x-timestamp"], request.headers["x-signature"], request.method, request.originalUrl, request.rawBody ?? Buffer.alloc(0));
    }
    if (requiredScope && !this.auth.apiKeyHasScope(key.scopes, requiredScope)) {
      throw new ForbiddenException({
        error: "forbidden_scope",
        message: `API key does not have '${requiredScope}' permission`
      });
    }
    const response = context.switchToHttp().getResponse();
    let rate;
    try { rate = await this.rate.consume(key.id, key.rateLimit); }
    catch { throw new ServiceUnavailableException({ error: "rate_limit_unavailable", message: "Rate limit store unavailable; retry shortly" }); }
    response.setHeader("X-RateLimit-Limit", rate.limit);
    response.setHeader("X-RateLimit-Remaining", rate.remaining);
    response.setHeader("X-RateLimit-Reset", rate.reset);
    if (!rate.allowed) {
      response.setHeader("Retry-After", Math.max(1, rate.reset - Math.floor(Date.now() / 1000)));
      throw new HttpException({ error: "rate_limited", message: "API key rate limit exceeded" }, 429);
    }
    return true;
  }
}
