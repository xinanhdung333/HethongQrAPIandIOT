import { Request, Response } from "express";
import { ApiRentalDto, UpdateApiKeyScopesDto } from "../dto";
import { AuthService } from "../security/auth.service";
import { ActivityLogService } from "../services/activity-log.service";
import { PlatformService } from "../services/platform.service";
export declare class ApiRentalsController {
    private readonly platform;
    private readonly auth;
    private readonly activity;
    constructor(platform: PlatformService, auth: AuthService, activity: ActivityLogService);
    list(authorization: string | undefined, req: Request, res: Response): Promise<any>;
    create(dto: ApiRentalDto, authorization: string | undefined, req: Request, res: Response): Promise<any>;
    private forward;
    updateKeyScopes(id: string, dto: UpdateApiKeyScopesDto, authorization: string | undefined, req: Request, res: Response): Promise<{
        id: string;
        userId: string;
        prefix: string;
        quota: number;
        scopes: any[];
        rentalId: string | null;
        status: string;
        isTest: boolean;
        allowedIps: any[];
        rateLimit: number;
        revokeAt: Date | null;
        suspendUntil: Date | null;
        createdAt: Date;
    } | undefined>;
    private allowCustomerOnly;
}
