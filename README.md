# SmartQR Platform

Monorepo cho SmartQR: thue hop quet IoT, white-label show, ban linh kien va API QR tich hop cho web/server/IoT.

- Thue thiet bi IoT: `/thue-thiet-bi`
- White-label show: `/tao-show` va `/e/[slug]`
- Ban linh kien: `/linh-kien`
- Thue API QR: `/thue-api`
- Developer console: `/dashboard/api-keys`

## Chay local

```powershell
docker compose up -d
npm run db:setup
npm run dev
```

Web: `http://localhost:3000`  
API: `http://localhost:4000`

Tai khoan seed:

- Customer: `demo@smartqr.vn` / `demo123456`
- Admin: `admin@smartqr.vn` / `admin123456`

## SmartQR API v1

API duoc thiet ke de dev ngoai tich hop vao backend rieng va IoT gateway:

- `POST /api/v1/qr-codes`: tao QR cho bat ky `resource_type`.
- `POST /api/v1/qr-codes/bulk`: tao toi da 500 QR/request.
- `GET /api/v1/qr-codes/:id/svg`: render SVG tu JWT.
- `POST /api/v1/tickets/verify`: verify QR/code, tra `decision: allow/deny`.
- `POST /api/v1/qr-codes/:id/revoke`: thu hoi QR.
- `GET /api/v1/status`: status page API.
- `/api/v1/developer/*`: key rotation, test key, settings, analytics, audit, webhook logs.

Response tao QR van giu tuong thich nguoc voi `qr_jwt`, `ticket_code` va object `qr.*`.

Tinh nang API:

- Scope theo key: `qr:create`, `qr:read`, `ticket:verify`.
- Rate limit theo key va headers `X-RateLimit-*`.
- Monthly quota va pay-as-you-go usage event.
- Test key `sk_test_...` khong tru quota live.
- HMAC request signing tuy chon.
- IP whitelist theo key.
- Key rotation: key cu `deprecated`, tu revoke sau 7 ngay.
- Webhook outbox: `qr.created`, `qr.expired`, `qr.verify_failed`, `ticket.verified`, legacy `qr.verified`, retry 1p/5p/30p.
- Metadata tu do, multi-use QR, allowed gate IDs, not-before, revoke.
- Audit log moi request qua API key.

## Chay test

```powershell
npm run db:generate
npm run build -w @smartqr/api
npm test -w @smartqr/sdk
```

Integration test can PostgreSQL test database rieng:

```powershell
$env:TEST_DATABASE_URL = "postgresql://smartqr:1@localhost:5432/smartqr_api_test_YYYYMMDDHHMMSS?schema=public"
npm run test:integration -w @smartqr/api
```

## Production env can co

```env
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."
JWT_SECRET="long-random-secret"
API_SECRET_ENCRYPTION_KEY="64_hex_chars"
WEB_ORIGIN="https://your-web.vn"
API_PUBLIC_URL="https://api.your-domain.vn"
TRUST_PROXY_HOPS="1"
```

`API_SECRET_ENCRYPTION_KEY` dung de ma hoa signing/webhook secrets trong database. Tao bang 32 bytes random hex.

## Luong demo

1. Vao `/thue-api`, tao don thue API va thanh toan demo.
2. Vao `/dashboard/api-keys`, tao `sk_test_...`, bat/tat HMAC, rotate key.
3. Vao `/thue-api`, dung API Explorer voi test key.
4. Dung terminal theo `cach-test-bang-terminal.md` de tao/verify QR.
5. Kiem tra audit, analytics va webhook logs trong developer console.
