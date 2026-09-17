import crypto from "crypto";
import { BlockList, isIP } from "net";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";

export function normalizeIp(ip: string) {
  const value = ip.split(",")[0]?.trim() ?? "";
  return value.startsWith("::ffff:") ? value.slice(7) : value;
}

export function ipAllowed(ip: string, entries: unknown) {
  if (!Array.isArray(entries) || entries.length === 0) return true;
  const normalized = normalizeIp(ip);
  const family = isIP(normalized) as 0 | 4 | 6;
  if (!family) return false;

  for (const entry of entries) {
    const rule = String(entry ?? "").trim();
    if (!rule) continue;
    if (matchesIpRule(normalized, family, rule)) return true;
  }
  return false;
}

function matchesIpRule(ip: string, family: 4 | 6, rule: string) {
  const normalizedRule = normalizeIp(rule);
  if (normalizedRule.includes("/")) return matchesCidr(ip, family, normalizedRule);
  if (family === 4 && normalizedRule.includes("-")) return matchesIpv4Range(ip, normalizedRule);
  return isIP(normalizedRule) === family && normalizedRule === ip;
}

function matchesCidr(ip: string, family: 4 | 6, rule: string) {
  const [address, prefixText] = rule.split("/");
  const prefix = Number(prefixText);
  const maxPrefix = family === 4 ? 32 : 128;
  if (isIP(address) !== family || !Number.isInteger(prefix) || prefix < 0 || prefix > maxPrefix) return false;
  const list = new BlockList();
  list.addSubnet(address, prefix, family === 4 ? "ipv4" : "ipv6");
  return list.check(ip, family === 4 ? "ipv4" : "ipv6");
}

function matchesIpv4Range(ip: string, rule: string) {
  const [start, end] = rule.split("-").map((part) => normalizeIp(part.trim()));
  if (isIP(start) !== 4 || isIP(end) !== 4) return false;
  const value = ipv4ToLong(ip);
  const from = ipv4ToLong(start);
  const to = ipv4ToLong(end);
  return value >= Math.min(from, to) && value <= Math.max(from, to);
}

function ipv4ToLong(ip: string) {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

export function verifyRequestSignature(secret: string, timestamp: unknown, signature: unknown, method: string, path: string, body: Buffer, now = Date.now()) {
  if (typeof timestamp !== "string" || !/^\d{10}$/.test(timestamp) || Math.abs(now - Number(timestamp) * 1000) > 300_000) {
    throw new UnauthorizedException({ error: "invalid_timestamp", message: "X-Timestamp must be Unix seconds within 5 minutes" });
  }
  const received = typeof signature === "string" ? signature.replace(/^sha256=/, "") : "";
  const expected = crypto.createHmac("sha256", secret).update(timestamp + method.toUpperCase() + path).update(body).digest();
  if (!/^[a-f\d]{64}$/i.test(received) || !crypto.timingSafeEqual(expected, Buffer.from(received, "hex"))) {
    throw new UnauthorizedException({ error: "invalid_signature", message: "Invalid X-Signature" });
  }
}

export function assertActiveKey(key: { status: string; revokeAt: Date | null; suspendUntil?: Date | null; rental?: { status: string } | null }) {
  if (key.status === "suspended" && (!key.suspendUntil || key.suspendUntil.getTime() > Date.now())) {
    throw new UnauthorizedException({ error: "key_suspended", message: "API key is temporarily suspended" });
  }
  if (key.status === "revoked" || (key.revokeAt && key.revokeAt.getTime() <= Date.now())) {
    throw new UnauthorizedException({ error: "key_revoked", message: "API key has been revoked" });
  }
  if (key.rental && key.rental.status !== "ACTIVE") {
    throw new ForbiddenException({ error: "rental_inactive", message: "API rental is not active" });
  }
}
