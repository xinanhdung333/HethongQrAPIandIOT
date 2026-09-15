import { PrismaClient } from "@prisma/client";

export function resolveTenantId(key: { rentalId?: string | null; userId: string }) {
  return key.rentalId ?? key.userId;
}

export async function isOfflineCapable(prisma: PrismaClient, tenantId: string) {
  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  return settings?.offlineCapable ?? false;
}

export async function enableOfflineCapable(prisma: PrismaClient, tenantId: string, enabledBy: string) {
  const now = new Date();
  await prisma.tenantSettings.upsert({
    where: { tenantId },
    update: { offlineCapable: true, enabledAt: now, enabledBy },
    create: { tenantId, offlineCapable: true, enabledAt: now, enabledBy }
  });
}
