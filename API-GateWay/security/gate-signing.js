"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGateKeyPairForTenant = getGateKeyPairForTenant;
exports.getGatePublicKeyForTenant = getGatePublicKeyForTenant;
exports.getLegacyGatePublicKey = getLegacyGatePublicKey;
exports.signOfflineQrToken = signOfflineQrToken;
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const secret_box_1 = require("./secret-box");
const keyCache = new Map();
async function getGateKeyPairForTenant(prisma, tenantId) {
    const cached = keyCache.get(tenantId);
    if (cached)
        return cached;
    const existing = await prisma.tenantGateKey.findUnique({ where: { tenantId } });
    if (existing) {
        const pair = { privateKey: normalizePem((0, secret_box_1.openSecret)(existing.privateKeyEnc)), publicKey: normalizePem(existing.publicKey) };
        keyCache.set(tenantId, pair);
        return pair;
    }
    const pair = generateKeyPair();
    try {
        await prisma.tenantGateKey.create({
            data: {
                tenantId,
                publicKey: pair.publicKey,
                privateKeyEnc: (0, secret_box_1.sealSecret)(pair.privateKey),
                algorithm: "RS256"
            }
        });
        keyCache.set(tenantId, pair);
        return pair;
    }
    catch {
        const createdByPeer = await prisma.tenantGateKey.findUnique({ where: { tenantId } });
        if (!createdByPeer)
            throw new Error("Unable to create tenant gate key");
        const winner = { privateKey: normalizePem((0, secret_box_1.openSecret)(createdByPeer.privateKeyEnc)), publicKey: normalizePem(createdByPeer.publicKey) };
        keyCache.set(tenantId, winner);
        return winner;
    }
}
async function getGatePublicKeyForTenant(prisma, tenantId) {
    const cached = keyCache.get(tenantId);
    if (cached)
        return cached.publicKey;
    const existing = await prisma.tenantGateKey.findUnique({ where: { tenantId } });
    if (existing)
        return normalizePem(existing.publicKey);
    const { publicKey } = await getGateKeyPairForTenant(prisma, tenantId);
    return publicKey;
}
function getLegacyGatePublicKey() {
    return process.env.GATE_RSA_PUBLIC_KEY ? normalizePem(process.env.GATE_RSA_PUBLIC_KEY) : null;
}
async function signOfflineQrToken(prisma, qr, tenantId) {
    const { privateKey } = await getGateKeyPairForTenant(prisma, tenantId);
    const payload = {
        sub: `${qr.subjectPrefix ?? "external"}:${qr.resourceType}:${qr.resourceId}`,
        type: qr.type ?? "external_qr_offline",
        tenant_id: tenantId,
        jti: qr.jti,
        resource_type: qr.resourceType,
        resource_id: qr.resourceId,
        is_test: qr.isTest
    };
    if (qr.notBefore)
        payload.nbf = Math.floor(qr.notBefore.getTime() / 1000);
    return jsonwebtoken_1.default.sign(payload, privateKey, { algorithm: "RS256", expiresIn: Math.max(1, Math.floor((qr.expiresAt.getTime() - Date.now()) / 1000)) });
}
function generateKeyPair() {
    return crypto_1.default.generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
}
function normalizePem(value) {
    return value.replace(/\\n/g, "\n");
}
