"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gateRedisTenantId = gateRedisTenantId;
const tenant_1 = require("./tenant");
function gateRedisTenantId(key, resourceType) {
    return resourceType === "ticket" ? key.userId : (0, tenant_1.resolveTenantId)(key);
}
