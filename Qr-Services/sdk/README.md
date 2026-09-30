# @smartqr/sdk

Thin Node.js wrapper cho SmartQR API v1. Dung trong backend cua app tich hop, khong dua raw API key ra browser.

```js
import { SmartQrClient } from "@smartqr/sdk";

const smartqr = new SmartQrClient({
  apiKey: process.env.SMARTQR_API_KEY,
  signingSecret: process.env.SMARTQR_SIGNING_SECRET,
  baseUrl: "http://localhost:4000"
});

const qr = await smartqr.createQrCode({
  resource_type: "iot_device",
  resource_id: "door-001-session",
  metadata: { tenant: "gym-abc" },
  allowed_gate_ids: ["gate-main"],
  ttl_seconds: 3600
}, { idempotencyKey: "door-001-session" });

const decision = await smartqr.verifyTicket({
  ticket_code: qr.ticket_code,
  gate_id: "gate-main"
});
```

Helpers:

- `createQrCode(resource, options)`
- `createQrCodes(resources, options)`
- `getQrSvgUrl(id)`
- `getQrSvg(id)`
- `verifyTicket(input, options)`
- `signRequest(secret, timestamp, method, path, body)`
- `verifyWebhookSignature(rawBody, signature, secret)`

Errors throw `SmartQrError` voi `code`, `status`, `requestId`, `retryAfter`.
