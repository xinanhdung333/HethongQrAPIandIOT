export type GateUsageResourceType = "external_qr" | "ticket";
export declare function gateRedisTenantId(key: {
    rentalId?: string | null;
    userId: string;
}, resourceType: GateUsageResourceType): string;
