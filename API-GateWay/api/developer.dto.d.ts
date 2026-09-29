declare const scopes: readonly ["qr:create", "qr:read", "ticket:verify"];
export declare class DeveloperUpdateKeyDto {
    scopes?: Array<typeof scopes[number]>;
    allowed_ips?: string[];
    rate_limit?: number;
}
export declare class DeveloperCreateKeyDto {
    scopes: Array<typeof scopes[number]>;
}
export declare class DeveloperRotateKeyDto {
    password: string;
    grace_minutes?: number;
}
export declare class DeveloperRentalSettingsDto {
    signing_enabled?: boolean;
    callback_url?: string;
}
export declare class DeveloperSecretDto {
    kind: "signing" | "webhook";
    password: string;
}
export declare class DeveloperPlanDto {
    plan: "starter" | "business";
    billing_mode: "fixed" | "payg";
}
export declare class DeveloperAuditQueryDto {
    from?: string;
    to?: string;
    endpoint?: string;
    status?: string;
    page?: string;
    is_test?: string;
}
export declare class DeveloperAnalyticsQueryDto {
    month?: string;
    key_id?: string;
    is_test?: string;
}
export {};
