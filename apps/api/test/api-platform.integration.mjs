import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { once } from "node:events";
import http from "node:http";
import { createRequire } from "node:module";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const port = Number(process.env.TEST_API_PORT || 4511);
const baseUrl = `http://127.0.0.1:${port}`;

if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required");

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const require = createRequire(import.meta.url);

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

function signPayosHeaders(body) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomBytes(16).toString("hex");
  const signature = crypto.createHmac("sha256", "payos-demo-dev-secret").update(`${timestamp}.${nonce}.`).update(body).digest("hex");
  return {
    "X-Payos-Timestamp": timestamp,
    "X-Payos-Nonce": nonce,
    "X-Payos-Signature": `sha256=${signature}`
  };
}

async function createRentalWithKey({ email, mode = "live", scopes = ["qr:create", "qr:read", "ticket:verify"], quota = 100, rateLimit = 60, isTest = false, signingSecret = null, signingEnabled = false, billingMode = "fixed", callbackUrl = null, webhookSecret = null, allowedIps = [] }) {
  const user = await prisma.user.create({
    data: { email, passwordHash: await bcrypt.hash("test-password", 4), role: "CUSTOMER" }
  });
  const rental = await prisma.apiRentalOrder.create({
    data: {
      userId: user.id,
      appName: email,
      plan: "starter",
      duration: 1,
      quota,
      scopes,
      total: 199000,
      status: "ACTIVE",
      signingEnabled,
      signingSecret,
      callbackUrl,
      webhookSecret,
      billingMode
    }
  });
  const raw = rawKey(mode, email.replace(/[^a-z0-9]/gi, ""));
  const key = await prisma.apiKey.create({
    data: {
      userId: user.id,
      rentalId: rental.id,
      keyHash: hashApiKey(raw),
      prefix: raw.slice(0, 20),
      quota,
      scopes,
      rateLimit,
      isTest,
      allowedIps
    }
  });
  await prisma.apiRentalOrder.update({ where: { id: rental.id }, data: { apiKeyPrefix: key.prefix } });
  return { user, rental, key, raw };
}

async function createKeyForUser({ user, email, mode = "live", scopes = ["qr:create", "qr:read", "ticket:verify"], quota = 100, rateLimit = 60 }) {
  const rental = await prisma.apiRentalOrder.create({
    data: {
      userId: user.id,
      appName: email,
      plan: "starter",
      duration: 1,
      quota,
      scopes,
      total: 199000,
      status: "ACTIVE"
    }
  });
  const raw = rawKey(mode, email.replace(/[^a-z0-9]/gi, ""));
  const key = await prisma.apiKey.create({
    data: {
      userId: user.id,
      rentalId: rental.id,
      keyHash: hashApiKey(raw),
      prefix: raw.slice(0, 20),
      quota,
      scopes,
      rateLimit
    }
  });
  await prisma.apiRentalOrder.update({ where: { id: rental.id }, data: { apiKeyPrefix: key.prefix } });
  return { rental, key, raw };
}

test("SmartQR API platform integration: scopes, sandbox, quota, bulk, rate and signing", async (t) => {
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
  await prisma.systemSetting.upsert({
    where: { key: "api_platform" },
    update: { value: { commission_rate_bp: 1000, quota_warning_thresholds: [80, 95], feature_flags: { api_explorer: true, bulk_create: true, pay_as_you_go: true }, plan_limits: { starter: { max_keys: 2, quota: 5000, rate_limit: 60, price: 199000 }, business: { max_keys: 10, quota: 30000, rate_limit: 600, price: 499000 } } } },
    create: { key: "api_platform", value: { commission_rate_bp: 1000, quota_warning_thresholds: [80, 95], feature_flags: { api_explorer: true, bulk_create: true, pay_as_you_go: true }, plan_limits: { starter: { max_keys: 2, quota: 5000, rate_limit: 60, price: 199000 }, business: { max_keys: 10, quota: 30000, rate_limit: 600, price: 499000 } } } }
  });

  const createOnly = await createRentalWithKey({ email: `create-only-${Date.now()}@test.local`, scopes: ["qr:create"] });
  const forbidden = await api("/api/v1/tickets/verify", { key: createOnly.raw, body: { ticket_code: "SQR-NOPE", gate_id: "gate-a" } });
  assert.equal(forbidden.response.status, 403);
  assert.equal(forbidden.data.error, "forbidden_scope");

  const full = await createRentalWithKey({ email: `full-${Date.now()}@test.local`, quota: 11, rateLimit: 50 });
  const created = await api("/api/v1/qr-codes", {
    key: full.raw,
    body: {
      resource_type: "parking_ticket",
      resource_id: "park-001",
      metadata: { lot: "A1" },
      max_uses: 2,
      allowed_gate_ids: ["entry-1"]
    },
    headers: { "Idempotency-Key": "create-parking-001" }
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.data.type, "external_qr");
  assert.equal(created.data.ticket_code.startsWith("SQR-"), true);
  assert.equal(created.data.qr.image_url.includes(`/api/v1/qr-codes/${created.data.id}/svg`), true);
  assert.deepEqual(created.data.metadata, { lot: "A1" });

  const replay = await api("/api/v1/qr-codes", {
    key: full.raw,
    body: {
      resource_type: "parking_ticket",
      resource_id: "park-001",
      metadata: { lot: "A1" },
      max_uses: 2,
      allowed_gate_ids: ["entry-1"]
    },
    headers: { "Idempotency-Key": "create-parking-001" }
  });
  assert.equal(replay.response.status, 201);
  assert.equal(replay.data.id, created.data.id);

  const deniedGate = await api("/api/v1/tickets/verify", { key: full.raw, body: { ticket_code: created.data.ticket_code, gate_id: "exit-9" } });
  assert.equal(deniedGate.response.status, 201);
  assert.equal(deniedGate.data.valid, false);
  assert.equal(deniedGate.data.error, "gate_not_allowed");

  const verified = await api("/api/v1/tickets/verify", { key: full.raw, body: { ticket_code: created.data.ticket_code, gate_id: "entry-1" } });
  assert.equal(verified.response.status, 201);
  assert.equal(verified.data.valid, true);
  assert.equal(verified.data.metadata.lot, "A1");

  const bulkResources = Array.from({ length: 10 }, (_, index) => ({ resource_type: "iot_session", resource_id: `bulk-${index}` }));
  const bulk = await api("/api/v1/qr-codes/bulk", { key: full.raw, body: { resources: bulkResources } });
  assert.equal(bulk.response.status, 201);
  assert.equal(bulk.data.results.length, 10);
  const overQuota = await api("/api/v1/qr-codes", { key: full.raw, body: { resource_type: "iot_session", resource_id: "over-quota" } });
  assert.equal(overQuota.response.status, 429);
  assert.equal(overQuota.data.error, "quota_exceeded");



  const cidrKey = await createRentalWithKey({ email: `cidr-${Date.now()}@test.local`, allowedIps: ["127.0.0.0/24"] });
  const cidrAllowed = await api("/api/v1/qr-codes", { key: cidrKey.raw, body: { resource_type: "iot_device", resource_id: "cidr-ok" } });
  assert.equal(cidrAllowed.response.status, 201);
  await prisma.apiKey.update({ where: { id: cidrKey.key.id }, data: { allowedIps: ["127.0.0.2-127.0.0.10"] } });
  const rangeBlocked = await api("/api/v1/qr-codes", { key: cidrKey.raw, body: { resource_type: "iot_device", resource_id: "range-block" } });
  assert.equal(rangeBlocked.response.status, 403);
  assert.equal(rangeBlocked.data.error, "ip_not_allowed");

  await prisma.systemSetting.update({ where: { key: "api_platform" }, data: { value: { commission_rate_bp: 1000, quota_warning_thresholds: [80, 95], feature_flags: { api_explorer: true, bulk_create: false, pay_as_you_go: true }, plan_limits: { starter: { max_keys: 2, quota: 5000, rate_limit: 60, price: 199000 }, business: { max_keys: 10, quota: 30000, rate_limit: 600, price: 499000 } } } } });
  const disabledBulk = await api("/api/v1/qr-codes/bulk", { key: full.raw, body: { resources: [{ resource_type: "iot_session", resource_id: "disabled-bulk" }] } });
  assert.equal(disabledBulk.response.status, 403);
  assert.equal(disabledBulk.data.error, "feature_disabled");
  await prisma.systemSetting.update({ where: { key: "api_platform" }, data: { value: { commission_rate_bp: 1000, quota_warning_thresholds: [80, 95], feature_flags: { api_explorer: true, bulk_create: true, pay_as_you_go: true }, plan_limits: { starter: { max_keys: 2, quota: 5000, rate_limit: 60, price: 199000 }, business: { max_keys: 10, quota: 30000, rate_limit: 600, price: 499000 } } } } });

  const testKey = await createRentalWithKey({ email: `sandbox-${Date.now()}@test.local`, mode: "test", isTest: true, quota: 1 });
  const sandbox = await api("/api/v1/qr-codes", { key: testKey.raw, body: { resource_type: "coupon", resource_id: "test-coupon" } });
  assert.equal(sandbox.response.status, 201);
  assert.equal(sandbox.data.is_test, true);
  const livePeriod = await prisma.apiUsagePeriod.findUnique({ where: { scopeId_month_isTest: { scopeId: testKey.rental.id, month: new Date().toISOString().slice(0, 7), isTest: false } } });
  assert.equal(livePeriod, null);

  const limited = await createRentalWithKey({ email: `limited-${Date.now()}@test.local`, rateLimit: 2 });
  const one = await api("/api/v1/qr-codes", { key: limited.raw, body: { resource_type: "rate", resource_id: "one" } });
  assert.equal(one.response.headers.get("x-ratelimit-limit"), "2");
  await api(`/api/v1/qr-codes/${one.data.id}`, { key: limited.raw, method: "GET" });
  const limitedOut = await api(`/api/v1/qr-codes/${one.data.id}`, { key: limited.raw, method: "GET" });
  assert.equal(limitedOut.response.status, 429);
  assert.equal(limitedOut.response.headers.has("x-ratelimit-reset"), true);

  const signed = await createRentalWithKey({ email: `signed-${Date.now()}@test.local`, signingEnabled: true, signingSecret: "sigsec_integration" });
  const unsigned = await api("/api/v1/qr-codes", { key: signed.raw, body: { resource_type: "door", resource_id: "unsigned" } });
  assert.equal(unsigned.response.status, 401);
  assert.equal(unsigned.data.error, "invalid_timestamp");
  const body = JSON.stringify({ resource_type: "door", resource_id: "signed" });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto.createHmac("sha256", "sigsec_integration").update(`${timestamp}POST/api/v1/qr-codes${body}`).digest("hex");
  const okSigned = await fetch(`${baseUrl}/api/v1/qr-codes`, {
    method: "POST",
    headers: { "X-API-KEY": signed.raw, "Content-Type": "application/json", "X-Timestamp": timestamp, "X-Signature": `sha256=${signature}` },
    body
  });
  assert.equal(okSigned.status, 201);

  const showOwner = await prisma.user.create({
    data: { email: `offline-show-${Date.now()}@test.local`, passwordHash: await bcrypt.hash("test-password", 4), role: "CUSTOMER" }
  });
  const showKey = await createKeyForUser({ user: showOwner, email: `offline-show-key-${Date.now()}@test.local` });
  await prisma.tenantSettings.upsert({
    where: { tenantId: showOwner.id },
    update: { offlineCapable: true, enabledAt: new Date(), enabledBy: showOwner.id },
    create: { tenantId: showOwner.id, offlineCapable: true, enabledAt: new Date(), enabledBy: showOwner.id }
  });
  const show = await prisma.show.create({
    data: {
      ownerId: showOwner.id,
      slug: `offline-show-${Date.now()}`,
      name: "Offline usage sync show",
      description: "Integration test show",
      bannerUrl: "https://example.com/banner.jpg",
      themeColor: "#18181b",
      location: "Test gate",
      startAt: new Date(Date.now() + 86_400_000),
      ticketPrice: 100000,
      totalTickets: 10,
      payoutAccount: {}
    }
  });
  const ticketOrder = await prisma.ticketOrder.create({
    data: {
      showId: show.id,
      buyerName: "Offline Buyer",
      buyerEmail: "offline-buyer@test.local",
      buyerPhone: "0900000000",
      quantity: 1,
      totalAmount: 100000,
      platformFee: 5000,
      payoutAmount: 95000
    }
  });
  const webhookBody = JSON.stringify({ order_id: ticketOrder.id, kind: "ticket" });
  const paidTicketOrder = await api("/webhooks/payos-demo", {
    body: { order_id: ticketOrder.id, kind: "ticket" },
    headers: signPayosHeaders(webhookBody)
  });
  assert.equal(paidTicketOrder.response.status, 201, `${JSON.stringify(paidTicketOrder.data)}\n${logs.join("")}`);
  const offlineTicket = await prisma.ticket.findFirstOrThrow({ where: { ticketOrderId: ticketOrder.id } });
  assert.equal(Boolean(offlineTicket.qrOfflineJwt), true);
  const usage = await api("/api/v1/gates/usage-events", {
    key: showKey.raw,
    body: { events: [{ jti: offlineTicket.jti, gate_id: "gate-offline-a", used_at: new Date().toISOString(), resource_type: "ticket" }] }
  });
  assert.equal(usage.response.status, 201, JSON.stringify(usage.data));
  assert.equal(usage.data.accepted_count, 1);
  const usedTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: offlineTicket.id } });
  assert.equal(usedTicket.isUsed, true);
  assert.equal(usedTicket.useCount, 1);
  const replayOnline = await api("/api/v1/tickets/verify", {
    key: showKey.raw,
    body: { ticket_code: offlineTicket.qrJwt, gate_id: "gate-online-a" }
  });
  assert.equal(replayOnline.response.status, 201);
  assert.equal(replayOnline.data.valid, false);
  assert.equal(replayOnline.data.reason, "Ticket already used");

  const audit = await prisma.apiRequestLog.count({ where: { endpoint: { startsWith: "/api/v1" } } });
  assert.ok(audit >= 1, `expected audit logs, got ${audit}. API logs:\n${logs.join("")}`);
});

test("webhook outbox signs payloads and schedules retry logs on callback failure", async () => {
  process.env.WEBHOOK_ALLOW_PRIVATE_URLS = "true";
  await prisma.$connect();
  await prisma.webhookEvent.updateMany({ where: { status: "pending" }, data: { status: "failed", lockedUntil: null } });
  const received = [];
  const callback = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => {
      received.push({ body: Buffer.concat(chunks).toString("utf8"), signature: req.headers["x-webhook-signature"] });
      res.statusCode = 500;
      res.end("retry me");
    });
  });
  callback.listen(0, "127.0.0.1");
  await once(callback, "listening");
  const address = callback.address();
  const callbackUrl = `http://127.0.0.1:${address.port}/webhooks/smartqr`;
  const rental = await createRentalWithKey({ email: `webhook-${Date.now()}@test.local`, callbackUrl, webhookSecret: "whsec_integration" });
  const child = spawn(process.execPath, ["dist/main.js"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl, PORT: String(port + 1), NODE_ENV: "test", API_JOBS_DISABLED: "true", JWT_SECRET: "integration-jwt-secret", REDIS_URL: "", WEBHOOK_ALLOW_PRIVATE_URLS: "true" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const logs = [];
  child.stdout.on("data", chunk => logs.push(String(chunk)));
  child.stderr.on("data", chunk => logs.push(String(chunk)));
  const previousBase = globalThis.fetch;
  try {
    const started = Date.now();
    while (Date.now() - started < 20_000) {
      try {
        const response = await fetch(`http://127.0.0.1:${port + 1}/api/v1/status`);
        if (response.ok) break;
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    const response = await fetch(`http://127.0.0.1:${port + 1}/api/v1/qr-codes`, {
      method: "POST",
      headers: { "X-API-KEY": rental.raw, "Content-Type": "application/json" },
      body: JSON.stringify({ resource_type: "iot_device", resource_id: "dev-001" })
    });
    assert.equal(response.status, 201, logs.join(""));
    const { WebhookDeliveryService } = require("../dist/services/webhook-delivery.service.js");
    const worker = new WebhookDeliveryService(prisma);
    assert.equal(await worker.processDue(new Date(), 1), 1);
    assert.equal(received.length, 1);
    assert.equal(received[0].signature.startsWith("sha256="), true);
    const event = await prisma.webhookEvent.findFirstOrThrow({ where: { rentalId: rental.rental.id, event: "qr.created" }, include: { logs: true } });
    assert.equal(event.status, "pending");
    assert.equal(event.attempts, 1);
    assert.equal(event.logs.length, 1);
    assert.equal(event.logs[0].statusCode, 500);
    assert.ok(event.nextAttemptAt.getTime() > Date.now());
  } finally {
    globalThis.fetch = previousBase;
    child.kill();
    callback.close();
    await prisma.$disconnect();
  }
});
