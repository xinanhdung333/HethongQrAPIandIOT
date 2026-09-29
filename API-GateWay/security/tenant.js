"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTenantId = resolveTenantId;
exports.isOfflineCapable = isOfflineCapable;
exports.enableOfflineCapable = enableOfflineCapable;
function resolveTenantId(key) {
    return key.rentalId ?? key.userId;
}
async function isOfflineCapable(prisma, tenantId) {
    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
    return settings?.offlineCapable ?? false;
}
async function enableOfflineCapable(prisma, tenantId, enabledBy) {
    const now = new Date();
    await prisma.tenantSettings.upsert({
        where: { tenantId },
        update: { offlineCapable: true, enabledAt: now, enabledBy },
        create: { tenantId, offlineCapable: true, enabledAt: now, enabledBy }
    });
}
