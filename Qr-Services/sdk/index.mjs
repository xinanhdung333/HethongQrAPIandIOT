import { createHmac, timingSafeEqual } from "node:crypto";

export class SmartQrError extends Error {
  constructor(message, { code = "request_failed", status = 0, requestId, retryAfter, body } = {}) {
    super(message);
    this.name = "SmartQrError";
    Object.assign(this, { code, status, requestId, retryAfter, body });
  }
}

/** Sign the exact UTF-8 body sent over the wire. Never re-serialize it after signing. */
export function signRequest(secret, timestamp, method, path, body = "") {
  return createHmac("sha256", secret).update(`${timestamp}${method.toUpperCase()}${path}${body}`).digest("hex");
}

/** Verify the raw webhook body before parsing JSON. */
export function verifyWebhookSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const hex = signature.replace(/^sha256=/, "");
  if (!/^[a-f0-9]{64}$/i.test(hex)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(hex, "hex"));
}

export class SmartQrClient {
  constructor({ apiKey, baseUrl = "http://localhost:4000", signingSecret, timeoutMs = 10000, fetch: fetchImpl = globalThis.fetch }) {
    if (!apiKey) throw new TypeError("apiKey is required; read it from your server environment.");
    const url = new URL(baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) throw new TypeError("baseUrl must use HTTP or HTTPS.");
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new TypeError("timeoutMs must be positive.");
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.signingSecret = signingSecret;
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImpl;
  }

  async request(method, path, input, { idempotencyKey, signal } = {}) {
    const body = input === undefined ? "" : JSON.stringify(input);
    const headers = { "X-API-KEY": this.apiKey, Accept: "application/json" };
    if (body) headers["Content-Type"] = "application/json";
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    if (this.signingSecret) {
      const timestamp = String(Math.floor(Date.now() / 1000));
      headers["X-Timestamp"] = timestamp;
      headers["X-Signature"] = signRequest(this.signingSecret, timestamp, method, path, body);
    }
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    if (signal?.aborted) abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(new Error("Request timed out")), this.timeoutMs);
    try {
      const response = await this.fetch(`${this.baseUrl}${path}`, {
        method, headers, ...(body ? { body } : {}), signal: controller.signal, redirect: "error"
      });
      const text = await response.text();
      let data = text;
      try { data = text ? JSON.parse(text) : undefined; } catch { /* SVG and plain text responses stay intact. */ }
      if (!response.ok) {
        throw new SmartQrError(data?.message || `SmartQR returned HTTP ${response.status}`, {
          code: data?.error || "request_failed", status: response.status, body: data,
          requestId: response.headers.get("x-request-id") || undefined,
          retryAfter: response.headers.get("retry-after") || undefined
        });
      }
      return data;
    } catch (error) {
      if (error instanceof SmartQrError) throw error;
      const aborted = controller.signal.aborted;
      throw new SmartQrError(aborted ? (signal?.aborted ? "Request cancelled" : "Request timed out") : "Could not connect to SmartQR", {
        code: aborted ? (signal?.aborted ? "request_cancelled" : "request_timeout") : "network_error"
      });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }

  createQrCode(resource, options) { return this.request("POST", "/api/v1/qr-codes", resource, options); }
  createQrCodes(resources, options) { return this.request("POST", "/api/v1/qr-codes/bulk", { resources }, options); }
  verifyTicket(input, options) { return this.request("POST", "/api/v1/tickets/verify", input, options); }
  getQrSvgUrl(id) { return `${this.baseUrl}/api/v1/qr-codes/${encodeURIComponent(id)}/svg`; }
  getQrSvg(id, options) { return this.request("GET", `/api/v1/qr-codes/${encodeURIComponent(id)}/svg`, undefined, options); }
}
