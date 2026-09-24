# SmartQR Platform

Monorepo cho SmartQR: thue hop quet IoT, white-label show, ban linh kien va API QR tich hop cho web/server/IoT.

- Thue thiet bi IoT: `/thue-thiet-bi`
- White-label show: `/tao-show` va `/e/[slug]`
- Ban linh kien: `/linh-kien`
- Thue API QR: `/thue-api`
- Developer console: `/dashboard/api-keys`

## Chay local

Dung tool `.bat` tren Windows/PowerShell:

```powershell
.\smartqr-dev-tool.bat
```

Lenh tren se chay full local app:

- Docker PostgreSQL + Redis co volume.
- Backend: API `:4000`, ticket service `:3003`, rental service `:3004`, QR service `:3005`.
- Frontend web `:3000`.

Mot so lenh phu:

```powershell
.\smartqr-dev-tool.bat all
.\smartqr-dev-tool.bat db
.\smartqr-dev-tool.bat ps
.\smartqr-dev-tool.bat stop 3000
.\smartqr-dev-tool.bat stop-all
.\smartqr-dev-tool.bat logs
.\smartqr-dev-tool.bat menu
```

Neu dung PowerShell, bat buoc co `.\` truoc ten file `.bat` vi PowerShell
khong tu chay lenh trong thu muc hien tai.

Chay thu cong:

```powershell
docker compose up -d
npm run db:setup
npm run dev
```

Web: `http://localhost:3000`  
API: `http://localhost:4000`

Ticket service tach rieng:

- App chinh (giu contract cho client): `http://localhost:4000`
- Ticket service: `http://localhost:3003`
- Verify qua app chinh: `POST /api/v1/tickets/verify`
- Verify truc tiep ticket service: `POST /api/v1/tickets/verify`

Chay rieng ticket service:

```powershell
npm run dev:ticket-service
```

Can chay app chinh song song de giu endpoint proxy:

```powershell
npm run dev -w @smartqr/api
```

Rental service tach rieng:

- App chinh (giu contract cho client): `http://localhost:4000/api-rentals`
- Rental service: `http://localhost:3004/api-rentals`
- Consume quota noi bo: `POST http://localhost:3004/internal/rentals/:id/consume-quota`
- Refund quota noi bo: `POST http://localhost:3004/internal/rentals/:id/refund-quota`

Chay rental service:

```powershell
npm run dev:rental-service
```

Endpoint `/internal/*` bat buoc nhan header `x-internal-service-token` trung voi
`INTERNAL_SERVICE_TOKEN`; khong dung API key cua khach hang.

QR service tach rieng:

- App chinh (giu contract cho client): `http://localhost:4000/api/v1/qr-codes`
- QR service: `http://localhost:3005/api/v1/qr-codes`
- SVG qua app chinh: `GET http://localhost:4000/api/v1/qr-codes/:id/svg`
- SVG truc tiep: `GET http://localhost:3005/api/v1/qr-codes/:id/svg`

Chay QR service:

```powershell
npm run dev:qr-service
```

Chay toan bo backend bang Docker Compose:

```powershell
docker compose up --build
```

Docker Compose se chay PostgreSQL, Redis, API chinh va ba service tach rieng.
Trong mang Docker, cac service goi nhau qua ten `ticket-service`, `rental-service`
va `qr-service`; tu may host van truy cap duoc lan luot tai cong 4000, 3003,
3004 va 3005. Stack Docker local chay voi `NODE_ENV=development`; khong dung
cac secrets nay cho production. Dung `docker compose down` de dung stack.

Neu Prisma bao loi khong tim thay OpenSSL trong container, build lai image sau
khi Dockerfile da cai `openssl`:

```powershell
docker compose down
docker compose build --no-cache
docker compose up
```

Khi tao QR, QR service goi `RENTAL_SERVICE_URL` de consume quota truoc.
Neu tao QR that bai, service goi lai endpoint refund quota; neu rental service
khong san sang thi QR khong duoc tao.

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

## Roadmap bao mat ve / QR

Hien tai he thong dung:

- `qrJwt` ky HMAC/HS256 bang `QR_JWT_SECRET` cho verify online.
- `qrOfflineJwt` ky RSA/RS256 cho gate offline, gate chi giu public key.
- Show Scan Key rieng cho may quet tung show, scope `ticket:verify`.
- DB/Redis check tiep: dung show, chua used, chua revoke, chua het han.

Cac nang cap nen lam sau de tien gan mo hinh Ticketmaster SafeTix / Google Wallet:

- Rotating QR/barcode: ma hien thi thay doi moi 15-60 giay de giam rui ro screenshot/resale ngoai he thong.
- Per-ticket rotating secret: moi ve co secret rieng de sinh ma dong, secret khong dua vao JWT/public payload.
- Wallet pass: xuat Apple Wallet / Google Wallet event ticket, pass duoc ky bang certificate/issuer key.
- Online + offline hybrid: online check DB realtime; offline dung RSA public key, revoked-delta va usage sync khi co mang.
- Key rotation cho offline tenant: ho tro `kid`/key version de gate chap nhan key cu trong grace window roi cat dan.
- Replay protection manh hon cho offline: gate luu local `jti` da quet, sync conflict ve server khi online lai.
- Admin/operator runbook: quy trinh revoke ve, rotate key, cap lai show scan key, va xu ly may quet bi mat.

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
