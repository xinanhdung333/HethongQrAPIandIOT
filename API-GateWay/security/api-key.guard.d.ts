import { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthService } from "./auth.service";
import { ApiRateLimitService } from "../services/api-rate-limit.service";
import { SystemSettingsService } from "../services/system-settings.service";
export declare class ApiKeyGuard implements CanActivate {
    private readonly reflector;
    private readonly auth;
    private readonly rate;
    private readonly settings;
    constructor(reflector: Reflector, auth: AuthService, rate: ApiRateLimitService, settings: SystemSettingsService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
