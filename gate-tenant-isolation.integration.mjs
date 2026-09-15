import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const port = Number(process.env.TEST_API_PORT || 4512);
const baseUrl = `http://127.0.0.1:${port}`;

if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required");

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

function hashApiKey(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function rawKey(mode, name) {
  return `sk_${mode}_${name}_${crypto.randomBytes(12).toString("hex")}`;
}

async function waitForServer(child, logs) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < 20_000) {
    if (child.exitCode !== null) throw new Error(`API process exited with ${child.exitCode}\n${logs.join("")}`);
    try {
      const response = await fetch(`${baseUrl}/api/v1/status`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`${lastError?.message || "API did not start"}\n${logs.join("")}`);
}

async function api(path, { key, body, headers = {}, method = "POST" } = {}) {
  const requestBody = body === undefined ? undefined : JSON.stringify(body);
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(key ? { "X-API-KEY": key } : {}),
      ...(requestBody ? { "Content-Type": "application/json" } : {}),
      ...headers
    },
    body: requestBody
  });
  const text = await response.text();
  let data = text;
  try { data = text ? JSON.parse(text) : undefined; } catch {}
  return { response, data };
}

/** rentalId: null tạo API key self-service không thuộc rental nào (dùng để test nhánh tenant = userId). */
async function createKey({ email, rentalId, scopes = ["qr:create", "qr:read", "ticket:verify"], quota = 100, rateLimit = 60 }) {
  const user = await prisma.user.create({
    data: { email, passwordHash: await bcrypt.hash("test-password", 4), role: "CUSTOMER" }
  });
  let rental = null;
  if (rentalId !== null) {
    rental = await prisma.apiRentalOrder.create({
      data: { userId: user.id, appName: email, plan: "starter", duration: 1, quota, scopes, total: 199000, status: "ACTIVE" }
    });
  }
  const raw = rawKey("live", email.replace(/[^a-z0-9]/gi, ""));
  const key = await prisma.apiKey.create({
    data: {
      userId: user.id,
      rentalId: rental?.id ?? null,
      keyHash: hashApiKey(raw),
      prefix: raw.slice(0, 20),
      quota,
      scopes,
      rateLimit,
      isTest: false,
      allowedIps: []
    }
  });
  if (rental) await prisma.apiRentalOrder.update({ where: { id: rental.id }, data: { apiKeyPrefix: key.prefix } });
  return { user, rental, key, raw };
}

test("SmartQR gate offline signing: per-tenant RSA isolation", async (t) => {
  await prisma.$connect();
  const child = spawn(process.execPath, ["dist/main.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      PORT: String(port),
      NODE_ENV: "test",
      API_JOBS_DISABLED: "true",
      JWT_SECRET: "integration-jwt-secret",
      REDIS_URL: "",
      WEBHOOK_ALLOW_PRIVATE_URLS: "true"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const logs = [];
  child.stdout.on("data", chunk => logs.push(String(chunk)));
  child.stderr.on("data", chunk => logs.push(String(chunk)));
  t.after(async () => {
    child.kill();
    await Promise.race([once(child, "exit"), new Promise(resolve => setTimeout(resolve, 1000))]);
    await prisma.$disconnect();
  });

  await waitForServer(child, logs);

  await t.test("public-key endpoint requires an API key", async () => {
    const { response } = await api("/api/v1/gates/public-key", { method: "GET" });
    assert.equal(response.status, 401);
  });

  const tenantA = await createKey({ email: `tenant-a-${Date.now()}@test.local` });
  const tenantB = await createKey({ email: `tenant-b-${Date.now()}@test.local` });

  let publicKeyA, tenantIdA, publicKeyB, tenantIdB;

  await t.test("mỗi tenant nhận đúng public key và tenant_id của chính mình", async () => {
    const resA = await api("/api/v1/gates/public-key", { method: "GET", key: tenantA.raw });
    assert.equal(resA.response.status, 200);
    publicKeyA = resA.data.public_key;
    tenantIdA = resA.data.tenant_id;
    assert.ok(publicKeyA.includes("BEGIN PUBLIC KEY"));

    const resB = await api("/api/v1/gates/public-key", { method: "GET", key: tenantB.raw });
    publicKeyB = resB.data.public_key;
    tenantIdB = resB.data.tenant_id;

    assert.notEqual(publicKeyA, publicKeyB, "2 tenant phải có 2 cặp khóa RSA khác nhau");
    assert.notEqual(tenantIdA, tenantIdB);
  });

  let offlineJwtA;

  await t.test("tạo vé cho tenant A và lấy qr_offline_jwt", async () => {
    const { response, data } = await api("/api/v1/qr-codes", {
      key: tenantA.raw,
      body: { resource_type: "ticket", resource_id: `evt-${crypto.randomUUID()}`, ttl_seconds: 3600 }
    });
    assert.equal(response.status, 201, JSON.stringify(data));
    offlineJwtA = data.qr_offline_jwt;
    assert.ok(offlineJwtA, "response phải có qr_offline_jwt");

    const decoded = jwt.decode(offlineJwtA);
    assert.equal(decoded.tenant_id, tenantIdA, "payload offline JWT phải chứa đúng tenant_id của tenant A");
  });

  await t.test("chữ ký vé tenant A KHÔNG verify được bằng public key của tenant B (lỗ hổng đã vá)", () => {
    assert.throws(() => {
      jwt.verify(offlineJwtA, publicKeyB, { algorithms: ["RS256"] });
    }, /invalid signature/i, "nếu dòng này fail nghĩa là 2 tenant đang dùng chung 1 key RSA — lỗ hổng cô lập tenant đã quay lại");
  });

  await t.test("chữ ký vé tenant A verify thành công bằng đúng public key của tenant A", () => {
    const decoded = jwt.verify(offlineJwtA, publicKeyA, { algorithms: ["RS256"] });
    assert.equal(decoded.tenant_id, tenantIdA);
  });

  await t.test("revoked-delta không rò rỉ chéo giữa rental và key self-service của cùng 1 user", async () => {
    // Tạo user sở hữu 1 rental + 1 key self-service riêng (không rentalId)
    const owner = await prisma.user.create({
      data: { email: `owner-${Date.now()}@test.local`, passwordHash: await bcrypt.hash("test-password", 4), role: "CUSTOMER" }
    });
    const rental = await prisma.apiRentalOrder.create({
      data: { userId: owner.id, appName: "owner-rental", plan: "starter", duration: 1, quota: 100, scopes: ["qr:create", "ticket:verify"], total: 199000, status: "ACTIVE" }
    });
    const rentalKeyRaw = rawKey("live", "ownerrental");
    const rentalKey = await prisma.apiKey.create({
      data: { userId: owner.id, rentalId: rental.id, keyHash: hashApiKey(rentalKeyRaw), prefix: rentalKeyRaw.slice(0, 20), quota: 100, scopes: ["qr:create", "ticket:verify"], rateLimit: 60, isTest: false, allowedIps: [] }
    });
    const selfServiceRaw = rawKey("live", "ownerselfservice");
    const selfServiceKey = await prisma.apiKey.create({
      data: { userId: owner.id, rentalId: null, keyHash: hashApiKey(selfServiceRaw), prefix: selfServiceRaw.slice(0, 20), quota: 100, scopes: ["qr:create", "ticket:verify"], rateLimit: 60, isTest: false, allowedIps: [] }
    });

    const created = await api("/api/v1/qr-codes", {
      key: rentalKeyRaw,
      body: { resource_type: "ticket", resource_id: `evt-${crypto.randomUUID()}`, ttl_seconds: 3600 }
    });
    const revokedJti = jwt.decode(created.data.qr_offline_jwt).jti;
    await api(`/api/v1/qr-codes/${created.data.id}/revoke`, { key: rentalKeyRaw, method: "POST" });

    const delta = await api("/api/v1/gates/revoked-delta?since=1970-01-01T00:00:00.000Z", { method: "GET", key: selfServiceRaw });
    const jtis = delta.data.revoked.map(r => r.jti);
    assert.ok(!jtis.includes(revokedJti), "key self-service không được thấy revoke thuộc rental khác của cùng user");
  });
});
