# Cach test SmartQR API bang terminal

Tai lieu nay dung de test API cho app ngoai he thong, dac biet server IoT/gate scanner.

## 1. Chay backend va database

```powershell
docker compose up -d
npm run db:setup
npm run dev
```

API mac dinh: `http://localhost:4000`.

Raw API key chi hien mot lan sau khi thanh toan demo hoac khi tao test key trong `/dashboard/api-keys`.

```powershell
$apiKey = "sk_live_PASTE_KEY_HERE"
$testKey = "sk_test_PASTE_TEST_KEY_HERE"
```

## 2. Tao QR don

```powershell
$body = @{
  resource_type = "iot_device"
  resource_id = "door-001-session"
  customer_ref = "Nguyen Van A"
  ttl_seconds = 3600
  max_uses = 1
  allowed_gate_ids = @("gate-main")
  metadata = @{
    tenant = "gym-abc"
    plan = "gold"
  }
} | ConvertTo-Json -Depth 8

$created = Invoke-RestMethod `
  -Uri "http://localhost:4000/api/v1/qr-codes" `
  -Method POST `
  -Headers @{ "X-API-KEY" = $apiKey; "Idempotency-Key" = "door-001-session-001" } `
  -ContentType "application/json" `
  -Body $body

$created
```

Response van giu cac field cu:

```json
{
  "qr_jwt": "...",
  "ticket_code": "SQR-...",
  "qr": {
    "value": "...",
    "format": "jwt",
    "code": "SQR-...",
    "image_url": "http://localhost:4000/api/v1/qr-codes/.../svg"
  }
}
```

## 3. Tai QR SVG

```powershell
Invoke-WebRequest `
  -Uri $created.qr.image_url `
  -Headers @{ "X-API-KEY" = $apiKey } `
  -OutFile "smartqr-test.svg"
```

## 4. Verify tai gate IoT

```powershell
$verifyBody = @{
  ticket_code = $created.ticket_code
  gate_id = "gate-main"
} | ConvertTo-Json

$first = Invoke-RestMethod `
  -Uri "http://localhost:4000/api/v1/tickets/verify" `
  -Method POST `
  -Headers @{ "X-API-KEY" = $apiKey; "Idempotency-Key" = "verify-door-001-session-001" } `
  -ContentType "application/json" `
  -Body $verifyBody

$first
```

Ky vong:

```json
{
  "valid": true,
  "decision": "allow",
  "type": "external_qr",
  "resource_type": "iot_device",
  "resource_id": "door-001-session",
  "metadata": { "tenant": "gym-abc", "plan": "gold" }
}
```

Verify lai ma 1-lan-dung se tra:

```json
{
  "valid": false,
  "decision": "deny",
  "error": "qr_already_used",
  "message": "QR code already used"
}
```

## 5. Test scope

Key chi co `qr:create` ma goi verify se nhan:

```json
{
  "error": "forbidden_scope",
  "message": "API key does not have 'ticket:verify' permission"
}
```

## 6. Tao bulk QR

```powershell
$bulkBody = @{
  resources = 1..10 | ForEach-Object {
    @{
      resource_type = "parking_ticket"
      resource_id = "parking-$($_)"
      metadata = @{ lot = "A1" }
    }
  }
} | ConvertTo-Json -Depth 8

$bulk = Invoke-RestMethod `
  -Uri "http://localhost:4000/api/v1/qr-codes/bulk" `
  -Method POST `
  -Headers @{ "X-API-KEY" = $apiKey } `
  -ContentType "application/json" `
  -Body $bulkBody

$bulk.results.Count
```

Moi QR tao thanh cong se tru quota theo so QR that tao. Gioi han moi request: 500.

## 7. Rate limit headers

Moi request qua API key co headers:

```text
X-RateLimit-Limit
X-RateLimit-Remaining
X-RateLimit-Reset
```

Qua gioi han se nhan `429`:

```json
{
  "error": "rate_limited",
  "message": "API key rate limit exceeded"
}
```

## 8. Test mode va API Explorer

Dung `sk_test_...` trong `/thue-api` API Explorer. Test key tao QR that nhung `is_test = true`, khong tru quota live va khong lan vao analytics live.

## 9. HMAC request signing

Neu bat HMAC trong dashboard, moi request can co:

- `X-Timestamp`: Unix seconds, lech toi da 5 phut.
- `X-Signature`: `sha256=` + HMAC-SHA256 cua `timestamp + METHOD + path + body`.

PowerShell mau:

```powershell
$signingSecret = "sigsec_PASTE"
$path = "/api/v1/qr-codes"
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()
$body = @{ resource_type = "coupon"; resource_id = "coupon-001" } | ConvertTo-Json -Compress
$bytes = [System.Text.Encoding]::UTF8.GetBytes($timestamp + "POST" + $path + $body)
$keyBytes = [System.Text.Encoding]::UTF8.GetBytes($signingSecret)
$hmac = [System.Security.Cryptography.HMACSHA256]::new($keyBytes)
$signature = "sha256=" + (($hmac.ComputeHash($bytes) | ForEach-Object { $_.ToString("x2") }) -join "")

Invoke-RestMethod `
  -Uri "http://localhost:4000$path" `
  -Method POST `
  -Headers @{ "X-API-KEY" = $apiKey; "X-Timestamp" = $timestamp; "X-Signature" = $signature } `
  -ContentType "application/json" `
  -Body $body
```

## 10. Webhook

Webhook payload co format:

```json
{
  "id": "evt_...",
  "event": "qr.created",
  "data": {},
  "timestamp": "2026-09-09T00:00:00.000Z"
}
```

Header `X-Webhook-Signature` la HMAC-SHA256 tren raw body. Neu callback tra loi hoac timeout, SmartQR retry theo lich 1 phut, 5 phut, 30 phut va ghi log trong `/dashboard/api-keys`.

## 11. Payment split cho IoT/server

Sau khi IoT/server hoac payment gateway xac nhan khach da thanh toan, goi SmartQR de ghi giao dich va tach phi nen tang. Endpoint nay can API key co scope `ticket:verify` va bat buoc co `Idempotency-Key`.

```powershell
$paymentBody = @{
  rental_id = "API_RENTAL_ID_HERE"
  gross_amount = 100000
  metadata = @{
    source = "iot-gateway"
    terminal_id = "gate-pay-01"
  }
} | ConvertTo-Json -Depth 8

$payment = Invoke-RestMethod `
  -Uri "http://localhost:4000/api/v1/payments" `
  -Method POST `
  -Headers @{ "X-API-KEY" = $apiKey; "Idempotency-Key" = "pay-demo-100k-001" } `
  -ContentType "application/json" `
  -Body $paymentBody

$payment
```

Ky vong voi commission 10%:

```json
{
  "payment": {
    "gross_amount": 100000,
    "commission_rate_bp": 1000,
    "commission_amount": 10000,
    "user_amount": 90000,
    "status": "PAYOUT_PROCESSING"
  },
  "idempotent": false
}
```

Goi lai cung `Idempotency-Key` se tra lai cung transaction va `idempotent: true`, khong tao giao dich moi.

## 12. Trang dashboard lien quan

- `/dashboard/api-keys`: IP whitelist, scope, HMAC, secret reveal/rotate, audit CSV, webhook replay.
- `/dashboard/settings/payout`: avatar va tai khoan payout.
- `/dashboard/payments`: giao dich/payment split cua user.
- `/admin/api-platform`: admin settings, commission, plan limits, payment management.
- `/status`: public status page.

## 13. Lenh test tu dong

```powershell
npm run db:generate
npm run build -w @smartqr/api
npm test -w @smartqr/sdk

$env:TEST_DATABASE_URL = "postgresql://smartqr:1@localhost:5432/smartqr_api_test_YYYYMMDDHHMMSS?schema=public"
npm run test:integration -w @smartqr/api
```
