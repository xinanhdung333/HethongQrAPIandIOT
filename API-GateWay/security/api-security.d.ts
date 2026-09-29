export declare function normalizeIp(ip: string): string;
export declare function ipAllowed(ip: string, entries: unknown): boolean;
export declare function verifyRequestSignature(secret: string, timestamp: unknown, signature: unknown, method: string, path: string, body: Buffer, now?: number): void;
export declare function assertActiveKey(key: {
    status: string;
    revokeAt: Date | null;
    suspendUntil?: Date | null;
    rental?: {
        status: string;
    } | null;
}): void;
