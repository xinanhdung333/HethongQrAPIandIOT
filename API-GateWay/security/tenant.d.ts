import { PrismaClient } from "@prisma/client";
export declare function resolveTenantId(key: {
    rentalId?: string | null;
    userId: string;
}): string;
export declare function isOfflineCapable(prisma: PrismaClient, tenantId: string): Promise<any>;
export declare function enableOfflineCapable(prisma: PrismaClient, tenantId: string, enabledBy: string): Promise<void>;
