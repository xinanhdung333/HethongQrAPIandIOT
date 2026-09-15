import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const port = Number(process.env.TEST_PAYMENT_API_PORT || 4513);
const baseUrl = `http://127.0.0.1:${port}`;
if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required");
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

function hashApiKey(raw) { return crypto.createHash("sha256").update(raw).digest("hex"); }
async function waitForServer(child, logs) {
  const started = Date.now();
  while (Date.now() - started < 20_000) {
    if (child.exitCode !== null) throw new Error(`API process exited ${child.exitCode}\n${logs.join("")}`);
    try { if ((await fetch(`${baseUrl}/api/v1/status`)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`API did not start\n${logs.join("")}`);
}
async function post(path, { key, token, body, idempotencyKey } = {}) {
  const response = await fetch(`${baseUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...(key ? { "X-API-KEY": key } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) }, body: JSON.stringify(body ?? {}) });
  const text = await response.text();
  let data = text; try { data = text ? JSON.parse(text) : undefined; } catch {}
  return { response, data };
}
async function get(path, token) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const text = await response.text();
  let data = text; try { data = text ? JSON.parse(text) : undefined; } catch {}
  return { response, data };
}
async function createUser(email, role = "CUSTOMER") {
  return prisma.user.create({ data: { email, passwordHash: await bcrypt.hash("test-password", 4), role } });
}
async function login(email) {
  const res = await post("/auth/login", { body: { email, password: "test-password" } });
  assert.equal(res.response.status, 201, JSON.stringify(res.data));
  return res.data.access_token;
}

test("payment split snapshots commission, payout account and idempotency", async (t) => {
  await prisma.$connect();
  await prisma.systemSetting.upsert({ where: { key: "api_platform" }, update: { value: { commission_rate_bp: 1000, quota_warning_thresholds: [80, 95], feature_flags: { api_explorer: true, bulk_create: true, pay_as_you_go: true }, plan_limits: { starter: { max_keys: 5, quota: 5000, rate_limit: 60, price: 199000 }, business: { max_keys: 10, quota: 30000, rate_limit: 600, price: 499000 } } } }, create: { key: "api_platform", value: { commission_rate_bp: 1000, quota_warning_thresholds: [80, 95], feature_flags: { api_explorer: true, bulk_create: true, pay_as_you_go: true }, plan_limits: { starter: { max_keys: 5, quota: 5000, rate_limit: 60, price: 199000 }, business: { max_keys: 10, quota: 30000, rate_limit: 600, price: 499000 } } } } });
  const child = spawn(process.execPath, ["dist/main.js"], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl, PORT: String(port), NODE_ENV: "test", API_JOBS_DISABLED: "true", JWT_SECRET: "payment-integration-secret", REDIS_URL: "" }, stdio: ["ignore", "pipe", "pipe"] });
  const logs = [];
  child.stdout.on("data", chunk => logs.push(String(chunk)));
  child.stderr.on("data", chunk => logs.push(String(chunk)));
  t.after(async () => { child.kill(); await Promise.race([once(child, "exit"), new Promise(resolve => setTimeout(resolve, 1000))]); await prisma.$disconnect(); });
  await waitForServer(child, logs);

  const user = await createUser(`payment-${Date.now()}@test.local`);
  const userToken = await login(user.email);
  const firstPayout = await prisma.payoutAccount.create({ data: { userId: user.id, method: "BANK", bankName: "VCB", accountNumber: "111122223333", accountName: "Payment User", isDefault: true } });
  const secondPayout = await prisma.payoutAccount.create({ data: { userId: user.id, method: "BANK", bankName: "MB", accountNumber: "999988887777", accountName: "Payment User" } });
  const rental = await prisma.apiRentalOrder.create({ data: { userId: user.id, appName: "IoT Payment", plan: "starter", duration: 1, quota: 5000, scopes: ["qr:create", "qr:read", "ticket:verify"], total: 199000, status: "ACTIVE" } });
  const raw = `sk_live_payment_${crypto.randomBytes(12).toString("hex")}`;
  await prisma.apiKey.create({ data: { userId: user.id, rentalId: rental.id, keyHash: hashApiKey(raw), prefix: raw.slice(0, 20), quota: 5000, scopes: ["qr:create", "qr:read", "ticket:verify"], rateLimit: 60 } });

  const idemOne = `pay-100k-snapshot-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const idemTwo = `pay-100k-after-setting-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const created = await post("/api/v1/payments", { key: raw, idempotencyKey: idemOne, body: { rental_id: rental.id, gross_amount: 100000, metadata: { channel: "iot_gate", gateway_id: "gw-01" } } });
  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.payment.gross_amount, 100000);
  assert.equal(created.data.payment.commission_rate_bp, 1000);
  assert.equal(created.data.payment.commission_amount, 10000);
  assert.equal(created.data.payment.user_amount, 90000);
  assert.equal(created.data.payment.payout_account_id, firstPayout.id);
  assert.deepEqual(created.data.payment.metadata, { channel: "iot_gate", gateway_id: "gw-01" });

  const replay = await post("/api/v1/payments", { key: raw, idempotencyKey: idemOne, body: { rental_id: rental.id, gross_amount: 100000 } });
  assert.equal(replay.data.idempotent, true);
  assert.equal(replay.data.payment.id, created.data.payment.id);
  assert.equal(await prisma.paymentTransaction.count({ where: { idempotencyKey: idemOne } }), 1);

  await prisma.payoutAccount.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
  await prisma.payoutAccount.update({ where: { id: secondPayout.id }, data: { isDefault: true } });
  const storedFirst = await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: created.data.payment.id } });
  assert.equal(storedFirst.payoutAccountId, firstPayout.id);
  assert.equal(storedFirst.payoutAccountSnapshot.account_number, "111122223333");
  assert.deepEqual(storedFirst.metadata, { channel: "iot_gate", gateway_id: "gw-01" });
  assert.equal(storedFirst.payoutNote, null);

  await prisma.systemSetting.update({ where: { key: "api_platform" }, data: { value: { commission_rate_bp: 2000, quota_warning_thresholds: [80, 95], feature_flags: { api_explorer: true, bulk_create: true, pay_as_you_go: true }, plan_limits: { starter: { max_keys: 5, quota: 5000, rate_limit: 60, price: 199000 }, business: { max_keys: 10, quota: 30000, rate_limit: 600, price: 499000 } } } } });
  const createdAfterSetting = await post("/api/v1/payments", { key: raw, idempotencyKey: idemTwo, body: { rental_id: rental.id, gross_amount: 100000 } });
  assert.equal(createdAfterSetting.data.payment.commission_rate_bp, 2000);
  assert.equal((await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: created.data.payment.id } })).commissionRateBp, 1000);

  const forbidden = await get("/api/v1/admin/payments", userToken);
  assert.equal(forbidden.response.status, 401);
});
