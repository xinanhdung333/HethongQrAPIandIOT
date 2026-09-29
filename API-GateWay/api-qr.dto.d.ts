/** v1 accepts arbitrary resource types: integrations do not need server plugins. */
export declare class ApiCreateQrDto {
    resource_type: string;
    resource_id: string;
    customer_ref?: string;
    payload?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    ttl_seconds?: number;
    max_uses?: number;
    allowed_gate_ids?: string[];
    not_before?: string;
}
export declare class ApiBulkCreateQrDto {
    resources: ApiCreateQrDto[];
}
export declare class ApiVerifyQrDto {
    qr_jwt?: string;
    ticket_code?: string;
    gate_id: string;
}
