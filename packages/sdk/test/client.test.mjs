import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { SmartQrClient, SmartQrError, signRequest, verifyWebhookSignature } from "../src/index.mjs";

test("create preserves legacy QR response and signs exact bytes with idempotency", async () => {
  const expected = { qr_jwt: "jwt", ticket_code: "SQR-123", qr: { image_url: "/svg" } };
  const client = new SmartQrClient({ apiKey: "sk_test_unit", signingSecret: "secret", fetch: async (url, init) => {
    assert.equal(url, "http://localhost:4000/api/v1/qr-codes");
    assert.equal(init.headers["Idempotency-Key"], "order-1");
    assert.equal(init.headers["X-Signature"], signRequest("secret", init.headers["X-Timestamp"], "POST", "/api/v1/qr-codes", init.body));
    assert.equal(JSON.parse(init.body).metadata.label, "Cổng số 1");
    return Response.json(expected);
  } });
  assert.deepEqual(await client.createQrCode({ resource_type: "locker_access", resource_id: "1", metadata: { label: "Cổng số 1" } }, { idempotencyKey: "order-1" }), expected);
});

test("403 and 429 retain machine-readable error and retry timing", async () => {
  const client = new SmartQrClient({ apiKey: "key", fetch: async () => Response.json({ error: "rate_limited", message: "Slow down" }, { status: 429, headers: { "Retry-After": "60", "X-Request-ID": "req-123" } }) });
  await assert.rejects(client.verifyTicket({ ticket_code: "bad" }), e => e instanceof SmartQrError && e.code === "rate_limited" && e.status === 429 && e.retryAfter === "60" && e.requestId === "req-123");
});

test("verification denied response remains valid=false for fail-closed IoT", async () => {
  const client = new SmartQrClient({ apiKey: "key", fetch: async () => Response.json({ valid: false, reason: "already_used" }) });
  assert.equal((await client.verifyTicket({ ticket_code: "used" })).valid, false);
});

test("SVG stays text and ID cannot inject a path segment", async () => {
  const client = new SmartQrClient({ apiKey: "key", fetch: async url => { assert.ok(url.includes("qr-codes/a%2Fb/svg")); return new Response("<svg/>"); } });
  assert.equal(await client.getQrSvg("a/b"), "<svg/>");
  assert.equal(client.getQrSvgUrl("a/b"), "http://localhost:4000/api/v1/qr-codes/a%2Fb/svg");
});

test("webhook verifier detects payload tampering and malformed signatures", () => {
  const body = '{"event":"qr.created"}';
  const sig = createHmac("sha256", "secret").update(body).digest("hex");
  assert.ok(verifyWebhookSignature(body, `sha256=${sig}`, "secret"));
  assert.equal(verifyWebhookSignature(`${body} `, sig, "secret"), false);
  assert.equal(verifyWebhookSignature(body, "oops", "secret"), false);
});

test("request times out without retrying a state-changing operation", async () => {
  let count = 0;
  const client = new SmartQrClient({ apiKey: "key", timeoutMs: 5, fetch: (_url, init) => new Promise((_resolve, reject) => { count++; init.signal.addEventListener("abort", () => reject(new Error("aborted"))); }) });
  await assert.rejects(client.createQrCode({ resource_type: "test", resource_id: "1" }), e => e.code === "request_timeout");
  assert.equal(count, 1);
});
