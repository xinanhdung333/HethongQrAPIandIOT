import { AdminCreateApiKeyDto, AdminUpdateProductDto, AdminUpdateShowDto, AdminUpdateStaticPageDto } from "../dto";
import { AuthService } from "../security/auth.service";
import { ApiKeyIssuanceService } from "../services/api-key-issuance.service";
import { PrismaService } from "../services/prisma.service";
import { RedisService } from "../services/redis.service";
import { ActivityLogService } from "../services/activity-log.service";
export declare class AdminController {
    private readonly prisma;
    private readonly auth;
    private readonly redis;
    private readonly keys;
    private readonly activity;
    constructor(prisma: PrismaService, auth: AuthService, redis: RedisService, keys: ApiKeyIssuanceService, activity: ActivityLogService);
    summary(authorization?: string): Promise<{
        counts: {
            users: any;
            products: any;
            rentals: any;
            shows: any;
            ticketOrders: any;
            tickets: any;
            apiKeys: any;
            payouts: any;
            staticPages: any;
            activityLogs: any;
        };
        revenue: {
            total: any;
            payout: any;
            fee: any;
        };
        legacy_api_key_hashes: {
            previous_hits_today: number;
            sha256_hits_today: number;
        };
    }>;
    users(authorization?: string): Promise<any>;
    products(authorization?: string): Promise<any>;
    updateProduct(id: string, dto: AdminUpdateProductDto, authorization?: string): Promise<any>;
    orders(authorization?: string): Promise<any>;
    shows(authorization?: string): Promise<any>;
    updateShowStatus(id: string, dto: AdminUpdateShowDto, authorization?: string): Promise<any>;
    createShowScanKey(id: string, authorization?: string): Promise<{
        api_key_once: string;
        show_id: any;
        key_prefix: any;
    }>;
    rotateShowScanKey(id: string, body: {
        grace_minutes?: number;
    }, authorization?: string): Promise<{
        api_key_once: any;
        show_id: any;
        key_prefix: any;
        old_revoke_at: string;
    }>;
    updateShowInstallation(id: string, body: {
        status?: string;
        scanner_count?: number;
        note?: string;
    }, authorization?: string): Promise<any>;
    tickets(authorization?: string): Promise<any>;
    apiKeys(authorization?: string): Promise<any>;
    activityLogs(authorization?: string): Promise<any>;
    createApiKey(dto: AdminCreateApiKeyDto, authorization?: string): Promise<any>;
    staticPages(authorization?: string): Promise<any>;
    updateStaticPage(slug: string, dto: AdminUpdateStaticPageDto, authorization?: string): Promise<any>;
    private assertAdmin;
}
