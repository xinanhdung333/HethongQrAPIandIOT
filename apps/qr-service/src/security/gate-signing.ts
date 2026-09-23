import crypto from "crypto";
import jwt from "jsonwebtoken";
import { PrismaService } from "../services/prisma.service";
import { openSecret, sealSecret } from "./secret-box";

const keyCache = new Map<string, { privateKey: string; publicKey: string }>();

export async function getGateKeyPairForTenant(prisma: PrismaService, tenantId: string) {
  const cached = keyCache.get(tenantId);
  if (cached) return cached;

  const existing = await prisma.tenantGateKey.findUnique({ where: { tenantId } });
  if (existing) {
    const pair = { privateKey: normalizePem(openSecret(existing.privateKeyEnc)), publicKey: normalizePem(existing.publicKey) };
    keyCache.set(tenantId, pair);
    return pair;
  }

  const pair = generateKeyPair();
  try {
    await prisma.tenantGateKey.create({
      data: {
        tenantId,
        publicKey: pair.publicKey,
        privateKeyEnc: sealSecret(pair.privateKey),
        algorithm: "RS256"
      }
    });
    keyCache.set(tenantId, pair);
    return pair;
  } catch {
    const createdByPeer = await prisma.tenantGateKey.findUnique({ where: { tenantId } });
    if (!createdByPeer) throw new Error("Unable to create tenant gate key");
    const winner = { privateKey: normalizePem(openSecret(createdByPeer.privateKeyEnc)), publicKey: normalizePem(createdByPeer.publicKey) };
    keyCache.set(tenantId, winner);
    return winner;
  }
}

export function getLegacyGatePublicKey() {
  return process.env.GATE_RSA_PUBLIC_KEY ? normalizePem(process.env.GATE_RSA_PUBLIC_KEY) : null;
}

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

export async function signOfflineQrToken(prisma: PrismaService, qr: OfflineQrSigningPayload, tenantId: string) {
  const { privateKey } = await getGateKeyPairForTenant(prisma, tenantId);
  const payload: Record<string, unknown> = {
    sub: `${qr.subjectPrefix ?? "external"}:${qr.resourceType}:${qr.resourceId}`,
    type: qr.type ?? "external_qr_offline",
    tenant_id: tenantId,
    jti: qr.jti,
    resource_type: qr.resourceType,
    resource_id: qr.resourceId,
    is_test: qr.isTest
  };
  if (qr.notBefore) payload.nbf = Math.floor(qr.notBefore.getTime() / 1000);
  return jwt.sign(
    payload,
    privateKey,
    { algorithm: "RS256", expiresIn: Math.max(1, Math.floor((qr.expiresAt.getTime() - Date.now()) / 1000)) }
  );
}

function generateKeyPair() {
  return crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });
}

function normalizePem(value: string) {
  return value.replace(/\\n/g, "\n");
}
