import { Request } from "express";
import { AdminApiPlatformSettingsDto, AdminIncidentDto, PaymentCreateDto, PaymentQueryDto, PaymentStatusDto } from "../settings-payment.dto";
import { AuthService } from "../security/auth.service";
import { AccountSettingsService } from "../services/account-settings.service";
import { ActivityLogService } from "../services/activity-log.service";
import { PaymentTransactionsService } from "../services/payment-transactions.service";
import { PrismaService } from "../services/prisma.service";
import { SystemSettingsService } from "../services/system-settings.service";
export declare class PaymentsController {
    private readonly payments;
    constructor(payments: PaymentTransactionsService);
    create(dto: PaymentCreateDto, apiKey?: string, idempotencyKey?: string): Promise<any>;
}
export declare class DeveloperPaymentsController {
    private readonly payments;
    private readonly auth;
    constructor(payments: PaymentTransactionsService, auth: AuthService);
    list(query: PaymentQueryDto, authorization?: string): Promise<{
        items: any;
        total: any;
        page: number;
        summary: {
            gross_amount: any;
            commission_amount: any;
            user_amount: any;
        } | undefined;
    }>;
    private session;
}
export declare class AdminSettingsPaymentsController {
    private readonly auth;
    private readonly prisma;
    private readonly settings;
    private readonly payments;
    private readonly account;
    private readonly activity;
    constructor(auth: AuthService, prisma: PrismaService, settings: SystemSettingsService, payments: PaymentTransactionsService, account: AccountSettingsService, activity: ActivityLogService);
    getSettings(authorization?: string): Promise<{
        api_platform: import("../services/system-settings.service").ApiPlatformSettings;
    }>;
    updateSettings(dto: AdminApiPlatformSettingsDto, authorization: string | undefined, req: Request): Promise<{
        api_platform: import("../services/system-settings.service").ApiPlatformSettings;
        version: any;
    }>;
    users(authorization?: string): Promise<any>;
    revealPayout(id: string, authorization?: string): Promise<{
        account: any;
    }>;
    incidents(authorization?: string): Promise<{
        items: any;
    }>;
    createIncident(dto: AdminIncidentDto, authorization: string | undefined, req: Request): Promise<{
        incident: {
            id: string;
            title: string;
            status: string;
            started_at: string;
            resolved_at: string | null;
        };
    }>;
    updateIncident(id: string, dto: Partial<AdminIncidentDto>, authorization: string | undefined, req: Request): Promise<{
        incident: {
            id: string;
            title: string;
            status: string;
            started_at: string;
            resolved_at: string | null;
        };
    }>;
    adminPayments(query: PaymentQueryDto, authorization?: string): Promise<{
        items: any;
        total: any;
        page: number;
        summary: {
            gross_amount: any;
            commission_amount: any;
            user_amount: any;
        } | undefined;
    }>;
    updatePayment(id: string, dto: PaymentStatusDto, authorization?: string): Promise<{
        payment: {
            id: string;
            rental_id: string;
            qr_code_id: string | null;
            gross_amount: number;
            commission_rate_bp: number;
            commission_amount: number;
            user_amount: number;
            payout_account_id: string | null;
            payout_account_snapshot: unknown;
            metadata: {} | null;
            status: PaymentTransactionStatus;
            created_at: string;
            confirmed_at: string | null;
            payout_completed_at: string | null;
            updated_at: string;
        };
    }>;
    private publicIncident;
    private assertAdmin;
}
