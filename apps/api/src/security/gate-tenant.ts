import { resolveTenantId } from "./tenant";

export type GateUsageResourceType = "external_qr" | "ticket";

export function gateRedisTenantId(key: { rentalId?: string | null; userId: string }, resourceType: GateUsageResourceType) {
  return resourceType === "ticket" ? key.userId : resolveTenantId(key);
}
