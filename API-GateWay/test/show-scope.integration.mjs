import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import crypto from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const port = Number(process.env.TEST_SHOW_SCOPE_API_PORT || 4517);
const baseUrl = `http://127.0.0.1:${port}`;
const pepper = "show-scope-test-pepper";
if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required");
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const hash = value => crypto.createHmac("sha256", pepper).update(value).digest("hex");
const rawKey = label => `sq_live_${label}_${crypto.randomBytes(12).toString("hex")}`;

async function waitForServer(child, logs) {
  const started = Date.now();
  while (Date.now() - started < 20_000) {
    if (child.exitCode !== null) throw new Error(`API exited ${child.exitCode}\n${logs.join("")}`);
    try { if ((await fetch(`${baseUrl}/api/v1/status`)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`API did not start\n${logs.join("")}`);
}

async function request(path, { key, method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "X-API-KEY": key, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  return { response, data: text ? JSON.parse(text) : undefined };
}

test("show scanner gate sync stays scoped while rental keys retain full scope", async t => {
  await prisma.$connect();
  const owner = await prisma.user.create({ data: { email: `scope-${Date.now()}@test.local`, passwordHash: "test", role: "CUSTOMER" } });
  const makeShow = suffix => prisma.show.create({ data: {
    ownerId: owner.id, slug: `scope-${suffix}-${Date.now()}`, name: `Scope ${suffix}`, description: "test",
    bannerUrl: "", themeColor: "#18181b", location: "test", startAt: new Date(Date.now() + 86_400_000),
    ticketPrice: 100000, totalTickets: 1, payoutAccount: {}
  } });
  const [showA, showB] = await Promise.all([makeShow("a"), makeShow("b")]);
  const orderA = await prisma.ticketOrder.create({ data: { showId: showA.id, buyerName: "A", buyerEmail: "a@test.local", quantity: 1, totalAmount: 100000, platformFee: 5000, payoutAmount: 95000 } });
  const orderB = await prisma.ticketOrder.create({ data: { showId: showB.id, buyerName: "B", buyerEmail: "b@test.local", quantity: 1, totalAmount: 100000, platformFee: 5000, payoutAmount: 95000 } });
  const ticketA = await prisma.ticket.create({ data: { showId: showA.id, ticketOrderId: orderA.id, jti: `jti-a-${crypto.randomBytes(6).toString("hex")}`, qrJwt: "a" } });
  const ticketB = await prisma.ticket.create({ data: { showId: showB.id, ticketOrderId: orderB.id, jti: `jti-b-${crypto.randomBytes(6).toString("hex")}`, qrJwt: "b" } });
  const showRaw = rawKey("show");
  const rentalRaw = rawKey("rental");
  const rental = await prisma.apiRentalOrder.create({ data: { userId: owner.id, appName: "scope", plan: "starter", duration: 1, quota: 100, scopes: ["qr:create", "ticket:verify"], total: 0, status: "ACTIVE" } });
  const showKey = await prisma.apiKey.create({ data: { userId: owner.id, showId: showA.id, keyHash: hash(showRaw), prefix: showRaw.slice(0, 20), quota: 100, scopes: ["ticket:verify"], rateLimit: 60 } });
  const rentalKey = await prisma.apiKey.create({ data: { userId: owner.id, rentalId: rental.id, keyHash: hash(rentalRaw), prefix: rentalRaw.slice(0, 20), quota: 100, scopes: ["qr:create", "ticket:verify"], rateLimit: 60 } });
  const externalJti = `external-${crypto.randomBytes(6).toString("hex")}`;
  await prisma.externalQrCode.create({ data: { userId: owner.id, apiKeyId: rentalKey.id, jti: externalJti, code: `SQR-${crypto.randomBytes(6).toString("hex")}`, qrJwt: "external", resourceType: "asset", resourceId: "asset-1", expiresAt: new Date(Date.now() + 86_400_000), revokedAt: new Date() } });
  await prisma.revokedResource.createMany({ data: [
    { resourceType: "ticket", jti: ticketA.jti, revokedAt: new Date(), tenantId: owner.id, showId: showA.id, userId: owner.id, isTest: false },
    { resourceType: "ticket", jti: ticketB.jti, revokedAt: new Date(), tenantId: owner.id, showId: showB.id, userId: owner.id, isTest: false },
    { resourceType: "external_qr", jti: externalJti, revokedAt: new Date(), tenantId: rental.id, userId: owner.id, isTest: false }
  ] });
  const child = spawn(process.execPath, ["dist/main.js"], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl, REDIS_URL: "", PORT: String(port), NODE_ENV: "test", API_KEY_PEPPER: pepper, JWT_SECRET: "show-scope-test-jwt-secret", API_JOBS_DISABLED: "true" }, stdio: ["ignore", "pipe", "pipe"] });
  const logs = [];
  child.stdout.on("data", chunk => logs.push(String(chunk)));
  child.stderr.on("data", chunk => logs.push(String(chunk)));
  t.after(async () => { child.kill(); await Promise.race([once(child, "exit"), new Promise(resolve => setTimeout(resolve, 1000))]); await prisma.$disconnect(); });
  await waitForServer(child, logs);

  const showDelta = await request("/api/v1/gates/revoked-delta", { key: showRaw });
  assert.equal(showDelta.response.status, 200, JSON.stringify(showDelta.data));
  assert.deepEqual(showDelta.data.revoked.map(item => item.jti), [ticketA.jti]);
  const rentalDelta = await request("/api/v1/gates/revoked-delta", { key: rentalRaw });
  assert.equal(rentalDelta.response.status, 200);
  assert.ok(rentalDelta.data.revoked.some(item => item.jti === ticketB.jti));
  assert.ok(rentalDelta.data.revoked.some(item => item.jti === externalJti));

  const externalUsage = await request("/api/v1/gates/usage-events", { key: showRaw, method: "POST", body: { events: [{ jti: externalJti, gate_id: "gate-a", used_at: new Date().toISOString(), resource_type: "external_qr" }] } });
  assert.equal(externalUsage.response.status, 403);
  assert.equal(externalUsage.data.error, "show_key_external_qr");
  const outOfScope = await request("/api/v1/gates/usage-events", { key: showRaw, method: "POST", body: { events: [{ jti: ticketB.jti, gate_id: "gate-a", used_at: new Date().toISOString(), resource_type: "ticket" }] } });
  assert.equal(outOfScope.response.status, 201);
  assert.equal(outOfScope.data.accepted_count, 0);
  assert.deepEqual(outOfScope.data.rejected, [{ jti: ticketB.jti, reason: "out_of_show_scope" }]);
  assert.equal((await prisma.ticket.findUniqueOrThrow({ where: { id: ticketB.id } })).isUsed, false);
  const accepted = await request("/api/v1/gates/usage-events", { key: showRaw, method: "POST", body: { events: [{ jti: ticketA.jti, gate_id: "gate-a", used_at: new Date().toISOString(), resource_type: "ticket" }] } });
  assert.equal(accepted.response.status, 201);
  assert.equal(accepted.data.accepted_count, 1);
  assert.equal((await prisma.ticket.findUniqueOrThrow({ where: { id: ticketA.id } })).isUsed, true);
});
