import { Request } from "express";
import { LoginDto, RegisterDto, UpdateProfileDto } from "../dto";
import { ActivityLogService } from "../services/activity-log.service";
import { PlatformService } from "../services/platform.service";
export declare class AuthController {
    private readonly platform;
    private readonly activity;
    constructor(platform: PlatformService, activity: ActivityLogService);
    register(dto: RegisterDto, req: Request): Promise<{
        user: {
            id: string;
            email: string;
            role: string;
        };
        access_token: string;
    }>;
    login(dto: LoginDto, req: Request): Promise<{
        user: {
            id: string;
            email: string;
            role: string;
        };
        access_token: string;
    }>;
    me(authorization?: string): Promise<{
        user: {
            id: string;
            email: string;
            role: string;
        };
    }>;
    updateProfile(dto: UpdateProfileDto, authorization?: string, req?: Request): Promise<{
        user: {
            id: string;
            email: string;
            role: string;
        };
        access_token: string;
    }>;
    logout(authorization?: string, req?: Request): Promise<{
        revoked: boolean;
    }>;
}
