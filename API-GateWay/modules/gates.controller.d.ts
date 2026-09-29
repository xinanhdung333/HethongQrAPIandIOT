import { AuthService } from "../security/auth.service";
import { GateSyncService } from "../services/gate-sync.service";
import { PrismaService } from "../services/prisma.service";
type UsageEventBody = {
    events: {
        jti: string;
        gate_id: string;
        used_at: string;
        resource_type: "external_qr" | "ticket";
    }[];
};
export declare class GatesController {
    private readonly gates;
    private readonly auth;
    private readonly prisma;
    constructor(gates: GateSyncService, auth: AuthService, prisma: PrismaService);
    publicKey(raw: string): Promise<{
        public_key: string;
        algorithm: string;
        tenant_id: string;
        legacy_public_key: string | null;
    }>;
    enableOffline(raw: string): Promise<{
        tenant_id: string;
        offline_capable: boolean;
        enabled_at: any;
    }>;
    tenantSettings(raw: string): Promise<{
        tenant_id: string;
        offline_capable: any;
        enabled_at: any;
    }>;
    sessionPublicKey(authorization?: string): Promise<{
        public_key: string;
        algorithm: string;
        tenant_id: string;
        legacy_public_key: string | null;
    }>;
    revokedDelta(raw: string, since?: string): Promise<{
        revoked: any;
        server_time: string;
    }>;
    usageEvents(raw: string, body: UsageEventBody): Promise<{
        accepted_count: number;
        conflicts: {
            jti: string;
            first_gate: string;
            reported_gate: string;
        }[];
        rejected: {
            jti: string;
            reason: "out_of_show_scope";
        }[];
    }>;
    conflicts(raw: string): Promise<{
        redis_key: string;
        reported_gate: string;
        used_at: string;
    }[]>;
    private requireKey;
}
export {};
