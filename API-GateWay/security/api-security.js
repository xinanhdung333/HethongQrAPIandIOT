"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeIp = normalizeIp;
exports.ipAllowed = ipAllowed;
exports.verifyRequestSignature = verifyRequestSignature;
exports.assertActiveKey = assertActiveKey;
const crypto_1 = __importDefault(require("crypto"));
const net_1 = require("net");
const common_1 = require("@nestjs/common");
function normalizeIp(ip) {
    const value = ip.split(",")[0]?.trim() ?? "";
    return value.startsWith("::ffff:") ? value.slice(7) : value;
}
function ipAllowed(ip, entries) {
    if (!Array.isArray(entries) || entries.length === 0)
        return true;
    const normalized = normalizeIp(ip);
    const family = (0, net_1.isIP)(normalized);
    if (!family)
        return false;
    for (const entry of entries) {
        const rule = String(entry ?? "").trim();
        if (!rule)
            continue;
        if (matchesIpRule(normalized, family, rule))
            return true;
    }
    return false;
}
function matchesIpRule(ip, family, rule) {
    const normalizedRule = normalizeIp(rule);
    if (normalizedRule.includes("/"))
        return matchesCidr(ip, family, normalizedRule);
    if (family === 4 && normalizedRule.includes("-"))
        return matchesIpv4Range(ip, normalizedRule);
    return (0, net_1.isIP)(normalizedRule) === family && normalizedRule === ip;
}
function matchesCidr(ip, family, rule) {
    const [address, prefixText] = rule.split("/");
    const prefix = Number(prefixText);
    const maxPrefix = family === 4 ? 32 : 128;
    if ((0, net_1.isIP)(address) !== family || !Number.isInteger(prefix) || prefix < 0 || prefix > maxPrefix)
        return false;
    const list = new net_1.BlockList();
    list.addSubnet(address, prefix, family === 4 ? "ipv4" : "ipv6");
    return list.check(ip, family === 4 ? "ipv4" : "ipv6");
}
function matchesIpv4Range(ip, rule) {
    const [start, end] = rule.split("-").map((part) => normalizeIp(part.trim()));
    if ((0, net_1.isIP)(start) !== 4 || (0, net_1.isIP)(end) !== 4)
        return false;
    const value = ipv4ToLong(ip);
    const from = ipv4ToLong(start);
    const to = ipv4ToLong(end);
    return value >= Math.min(from, to) && value <= Math.max(from, to);
}
function ipv4ToLong(ip) {
    return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}
function verifyRequestSignature(secret, timestamp, signature, method, path, body, now = Date.now()) {
    if (typeof timestamp !== "string" || !/^\d{10}$/.test(timestamp) || Math.abs(now - Number(timestamp) * 1000) > 300_000) {
        throw new common_1.UnauthorizedException({ error: "invalid_timestamp", message: "X-Timestamp must be Unix seconds within 5 minutes" });
    }
    const received = typeof signature === "string" ? signature.replace(/^sha256=/, "") : "";
    const expected = crypto_1.default.createHmac("sha256", secret).update(timestamp + method.toUpperCase() + path).update(body).digest();
    if (!/^[a-f\d]{64}$/i.test(received) || !crypto_1.default.timingSafeEqual(expected, Buffer.from(received, "hex"))) {
        throw new common_1.UnauthorizedException({ error: "invalid_signature", message: "Invalid X-Signature" });
    }
}
function assertActiveKey(key) {
    if (key.status === "suspended" && (!key.suspendUntil || key.suspendUntil.getTime() > Date.now())) {
        throw new common_1.UnauthorizedException({ error: "key_suspended", message: "API key is temporarily suspended" });
    }
    if (key.status === "revoked" || (key.revokeAt && key.revokeAt.getTime() <= Date.now())) {
        throw new common_1.UnauthorizedException({ error: "key_revoked", message: "API key has been revoked" });
    }
    if (key.rental && key.rental.status !== "ACTIVE") {
        throw new common_1.ForbiddenException({ error: "rental_inactive", message: "API rental is not active" });
    }
}
