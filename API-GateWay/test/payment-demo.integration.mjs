import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const port = Number(process.env.TEST_PAYMENT_DEMO_API_PORT || 4515);
const baseUrl = `http://127.0.0.1:${port}`;
const secret = "payment-link-test-secret";
if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required");
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

async function waitForServer(child, logs) {
  const started = Date.now();
  while (Date.now() - started < 20_000) {
    if (child.exitCode !== null) throw new Error(`API exited ${child.exitCode}\n${logs.join("")}`);
    try {
      if ((await fetch(`${baseUrl}/api/v1/status`)).ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`API did not start\n${logs.join("")}`);
}

async function startApi(demoMode) {
  const logs = [];
  const child = spawn(process.execPath, ["dist/main.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      REDIS_URL: "",
      PORT: String(port),
      NODE_ENV: "test",
      PAYMENT_DEMO_MODE: demoMode ? "true" : "false",
      PAYMENT_LINK_SECRET: secret,
      API_JOBS_DISABLED: "true",
      JWT_SECRET: "payment-demo-test-jwt-secret"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", chunk => logs.push(String(chunk)));
  child.stderr.on("data", chunk => logs.push(String(chunk)));
  await waitForServer(child, logs);
  return child;
}

async function paymentLinkCallback(orderId, expires) {
  const kind = "ticket";
  const signature = crypto.createHmac("sha256", secret).update(`${orderId}.${kind}.${expires}`).digest("hex");
  const response = await fetch(`${baseUrl}/webhooks/payos-demo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Payment-Expires": String(expires),
      "X-Payment-Signature": signature
    },
    body: JSON.stringify({ order_id: orderId, kind })
  });
  const text = await response.text();
  return { response, data: text ? JSON.parse(text) : undefined, signature };
}

test("payment-link callbacks require demo mode and reject replay", async t => {
  await prisma.$connect();
  const owner = await prisma.user.create({
    data: {
      email: `payment-demo-${Date.now()}@test.local`,
      passwordHash: "test",
      role: "CUSTOMER"
    }
  });
  const show = await prisma.show.create({
    data: {
      ownerId: owner.id,
      slug: `payment-demo-${Date.now()}`,
      name: "Payment demo test",
      description: "Payment demo test",
      bannerUrl: "",
      themeColor: "#18181b",
      location: "Test",
      startAt: new Date(Date.now() + 86_400_000),
      ticketPrice: 100000,
      totalTickets: 1,
      payoutAccount: {}
    }
  });
  const order = await prisma.ticketOrder.create({
    data: {
      showId: show.id,
      buyerName: "Demo Buyer",
      buyerEmail: "demo-buyer@test.local",
      quantity: 1,
      totalAmount: 100000,
      platformFee: 5000,
      payoutAmount: 95000
    }
  });
  const expires = Math.floor(Date.now() / 1000) + 300;
  let child = await startApi(false);
  t.after(async () => {
    if (child.exitCode === null) child.kill();
    await Promise.race([once(child, "exit"), new Promise(resolve => setTimeout(resolve, 1000))]);
    await prisma.$disconnect();
  });

  const disabled = await paymentLinkCallback(order.id, expires);
  assert.equal(disabled.response.status, 403, JSON.stringify(disabled.data));
  assert.equal(disabled.data.error, "demo_payment_disabled");
  assert.equal((await prisma.ticketOrder.findUniqueOrThrow({ where: { id: order.id } })).status, "PENDING");

  child.kill();
  await once(child, "exit");
  child = await startApi(true);
  const accepted = await paymentLinkCallback(order.id, expires);
  assert.equal(accepted.response.status, 201, JSON.stringify(accepted.data));
  assert.equal((await prisma.ticketOrder.findUniqueOrThrow({ where: { id: order.id } })).status, "PAID");

  const replay = await paymentLinkCallback(order.id, expires);
  assert.equal(replay.response.status, 401, JSON.stringify(replay.data));
  assert.equal(replay.data.error, "payment_link_replayed");
});
