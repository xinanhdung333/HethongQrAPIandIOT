# Cach test scope/permission API key

Tu ban mo rong Thue API Phase 1, moi API key co scopes:

```text
qr:create
qr:read
ticket:verify
```

Endpoint can scope:

```text
POST /api/v1/qr-codes          -> qr:create
GET  /api/v1/qr-codes/:id/svg  -> qr:read
POST /api/v1/tickets/verify    -> ticket:verify
```

## 1. Tao key test chi co qr:create

Chay lenh nay trong thu muc project, khong chay o `C:\Users\ADMIN`:

```powershell
cd C:\HeThongQRthongminh
```

```powershell
$raw = "sk_demo_scope_create_only_" + [guid]::NewGuid().ToString("N")
$hash = [System.BitConverter]::ToString(
  [System.Security.Cryptography.SHA256]::Create().ComputeHash(
    [System.Text.Encoding]::UTF8.GetBytes($raw)
  )
).Replace("-", "").ToLower()
$prefix = $raw.Substring(0, 12)

$env:KEY_HASH = $hash
$env:KEY_PREFIX = $prefix

node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); (async () => { const user = await prisma.user.findFirst({ where: { email: 'demo@smartqr.vn' } }); await prisma.apiKey.create({ data: { userId: user.id, keyHash: process.env.KEY_HASH, prefix: process.env.KEY_PREFIX, quota: 100, scopes: ['qr:create'] } }); await prisma.`$disconnect(); })();"
```

## 2. Goi endpoint verify bang key thieu ticket:verify

```powershell
$verifyBody = @{
  ticket_code = "SQR-NOTREAL"
  gate_id = "gate-main"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://localhost:4000/api/v1/tickets/verify" `
  -Method POST `
  -Headers @{ "X-API-KEY" = $raw } `
  -ContentType "application/json" `
  -Body $verifyBody
```

Ky vong HTTP `403 Forbidden`:

```json
{
  "error": "forbidden_scope",
  "message": "API key does not have 'ticket:verify' permission"
}
```

## 3. Test key full scope van chay nhu cu

```powershell
$apiKey = "sk_demo_PASTE_YOUR_KEY_HERE"

$body = @{
  resource_type = "gym_member"
  resource_id = "member_scope_full_test_001"
  customer_ref = "Scope Full Test"
  ttl_seconds = 86400
} | ConvertTo-Json

$created = Invoke-RestMethod `
  -Uri "http://localhost:4000/api/v1/qr-codes" `
  -Method POST `
  -Headers @{ "X-API-KEY" = $apiKey } `
  -ContentType "application/json" `
  -Body $body

$created.qr.image_url
```

Ky vong:

```text
http://localhost:4000/api/v1/qr-codes/<id>/svg
```

## 4. Test user update scope cua key

Dang nhap demo de lay token:

```powershell
$login = Invoke-RestMethod `
  -Uri "http://localhost:4000/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body (@{ email = "demo@smartqr.vn"; password = "demo123456" } | ConvertTo-Json)

$token = $login.access_token
```

Lay key dau tien cua user:

```powershell
$dash = Invoke-RestMethod `
  -Uri "http://localhost:4000/dashboard" `
  -Headers @{ Authorization = "Bearer $token" }

$key = $dash.apiKeys | Select-Object -First 1
```

Cap nhat key ve full scope:

```powershell
$updated = Invoke-RestMethod `
  -Uri "http://localhost:4000/api-rentals/api-keys/$($key.id)/scopes" `
  -Method PATCH `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body (@{ scopes = @("qr:create", "qr:read", "ticket:verify") } | ConvertTo-Json)

$updated.scopes
```

Ky vong:

```text
qr:create
qr:read
ticket:verify
```
