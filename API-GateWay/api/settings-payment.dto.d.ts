export declare class PasswordDto {
    password: string;
}
export declare class AvatarUploadDto {
    avatar_data_url: string;
}
export declare class PayoutAccountDto {
    method: "BANK" | "WALLET";
    bank_name?: string;
    account_number?: string;
    account_name: string;
    branch?: string;
    wallet_type?: string;
    wallet_id?: string;
    is_default?: boolean;
}
export declare class PaymentCreateDto {
    qr_code_id?: string;
    rental_id?: string;
    gross_amount: number;
    metadata?: Record<string, unknown>;
}
export declare class PaymentQueryDto {
    from?: string;
    to?: string;
    status?: string;
    rental_id?: string;
    page?: string;
}
export declare class PaymentStatusDto {
    status: "PENDING" | "CONFIRMED" | "PAYOUT_PROCESSING" | "PAYOUT_COMPLETED" | "FAILED" | "DISPUTED";
    note?: string;
}
export declare class AdminApiPlatformSettingsDto {
    commission_rate_bp?: number;
    quota_warning_thresholds?: number[];
    quota_burst?: {
        window_minutes?: number;
        threshold_percent?: number;
        enabled?: boolean;
    };
    feature_flags?: Record<string, boolean>;
    plan_limits?: Record<string, {
        max_keys?: number;
        quota?: number;
        rate_limit?: number;
        price?: number;
    }>;
}
export declare class AdminIncidentDto {
    title: string;
    status: "investigating" | "identified" | "monitoring" | "resolved";
    started_at?: string;
    resolved_at?: string;
}
