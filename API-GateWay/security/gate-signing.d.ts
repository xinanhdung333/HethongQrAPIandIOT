import { PrismaService } from "../services/prisma.service";
export declare function getGateKeyPairForTenant(prisma: PrismaService, tenantId: string): Promise<{
    privateKey: string;
    publicKey: string;
}>;
export declare function getGatePublicKeyForTenant(prisma: PrismaService, tenantId: string): Promise<string>;
export declare function getLegacyGatePublicKey(): string | null;
export type OfflineQrSigningPayload = {
    jti: string;
    resourceType: string;
    resourceId: string;
    expiresAt: Date;
    notBefore?: Date | null;
    isTest: boolean;
    subjectPrefix?: string;
    type?: string;
};
export declare function signOfflineQrToken(prisma: PrismaService, qr: OfflineQrSigningPayload, tenantId: string): Promise<string>;
