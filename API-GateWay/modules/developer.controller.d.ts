import { Request, Response } from "express";
import { DeveloperAnalyticsQueryDto, DeveloperAuditQueryDto, DeveloperCreateKeyDto, DeveloperPlanDto, DeveloperRentalSettingsDto, DeveloperRotateKeyDto, DeveloperSecretDto, DeveloperUpdateKeyDto } from "../developer.dto";
import { AuthService } from "../security/auth.service";
import { ActivityLogService } from "../services/activity-log.service";
import { DeveloperService } from "../services/developer.service";
export declare class DeveloperController {
    private readonly developer;
    private readonly auth;
    private readonly activity;
    constructor(developer: DeveloperService, auth: AuthService, activity: ActivityLogService);
    overview(authorization: string | undefined, req: Request, res: Response): Promise<{
        keys: any;
        rentals: any;
        notifications: any;
    } | undefined>;
    updateKey(id: string, dto: DeveloperUpdateKeyDto, authorization: string | undefined, res: Response): Promise<{
        key: {
            id: string;
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
        };
    } | undefined>;
    rotate(id: string, dto: DeveloperRotateKeyDto, authorization: string | undefined, req: Request, res: Response): Promise<{
        api_key_once: any;
        key: {
            id: string;
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
        };
        old_revoke_at: string;
    } | undefined>;
    revoke(id: string, authorization: string | undefined, req: Request, res: Response): Promise<{
        key: {
            id: string;
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
        };
    } | undefined>;
    suspend(id: string, dto: {
        until?: string;
    }, authorization: string | undefined, req: Request, res: Response): Promise<{
        key: {
            id: string;
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
        };
    } | undefined>;
    resume(id: string, authorization: string | undefined, req: Request, res: Response): Promise<{
        key: {
            id: string;
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
        };
    } | undefined>;
    testKey(id: string, authorization: string | undefined, res: Response): Promise<{
        api_key_once: string;
        key: {
            id: string;
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
        };
    } | undefined>;
    createKey(id: string, dto: DeveloperCreateKeyDto, authorization: string | undefined, res: Response): Promise<{
        api_key_once: string;
        key: {
            id: string;
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
        };
    } | undefined>;
    settings(id: string, dto: DeveloperRentalSettingsDto, authorization: string | undefined, res: Response): Promise<{
        rental: {
            id: string;
            appName: string;
            website: string | null;
            callbackUrl: string | null;
            plan: string;
            duration: number;
            quota: number;
            scopes: any[];
            total: number;
            status: RentalStatus;
            apiKeyPrefix: string | null;
            signingEnabled: boolean;
            billingMode: string;
            createUnitPrice: number;
            verifyUnitPrice: number;
            allowedScopes: import("../security/api-key.decorator").ApiKeyScope[];
            createdAt: Date;
            updatedAt: Date;
        };
    } | undefined>;
    secret(id: string, dto: DeveloperSecretDto, authorization: string | undefined, req: Request, res: Response): Promise<{
        secret_once: string;
        rental: {
            id: string;
            appName: string;
            website: string | null;
            callbackUrl: string | null;
            plan: string;
            duration: number;
            quota: number;
            scopes: any[];
            total: number;
            status: RentalStatus;
            apiKeyPrefix: string | null;
            signingEnabled: boolean;
            billingMode: string;
            createUnitPrice: number;
            verifyUnitPrice: number;
            allowedScopes: import("../security/api-key.decorator").ApiKeyScope[];
            createdAt: Date;
            updatedAt: Date;
        };
    } | undefined>;
    secrets(id: string, dto: {
        password?: string;
    }, authorization: string | undefined, req: Request, res: Response): Promise<{
        signing_secret: string | null;
        webhook_secret: string | null;
    } | undefined>;
    plan(id: string, dto: DeveloperPlanDto, authorization: string | undefined, res: Response): Promise<{
        rental: {
            id: string;
            appName: string;
            website: string | null;
            callbackUrl: string | null;
            plan: string;
            duration: number;
            quota: number;
            scopes: any[];
            total: number;
            status: RentalStatus;
            apiKeyPrefix: string | null;
            signingEnabled: boolean;
            billingMode: string;
            createUnitPrice: number;
            verifyUnitPrice: number;
            allowedScopes: import("../security/api-key.decorator").ApiKeyScope[];
            createdAt: Date;
            updatedAt: Date;
        };
    } | undefined>;
    analytics(query: DeveloperAnalyticsQueryDto, authorization: string | undefined, res: Response): Promise<{
        month: string;
        is_test: boolean;
        totals: {
            requests: any;
            qr_created: any;
            verify_success: any;
            verify_failed: any;
            billed_amount: any;
        };
        daily: any;
        resource_types: any;
        usage: any;
    } | undefined>;
    audit(query: DeveloperAuditQueryDto, authorization: string | undefined, res: Response): Promise<{
        items: any;
        total: any;
        page: number;
    } | undefined>;
    auditExport(query: DeveloperAuditQueryDto, authorization: string | undefined, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    securityEvents(query: {
        from?: string;
        to?: string;
        action?: string;
        page?: string;
    }, authorization: string | undefined, res: Response): Promise<{
        items: any;
        total: any;
        page: number;
    } | undefined>;
    webhooks(page: string | undefined, authorization: string | undefined, res: Response): Promise<{
        items: any;
        total: any;
        page: number;
    } | undefined>;
    retryWebhook(id: string, authorization: string | undefined, res: Response): Promise<{
        item: any;
    } | undefined>;
    private session;
}
