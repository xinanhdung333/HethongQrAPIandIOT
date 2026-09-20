# KẾ HOẠCH TEST TAY — SmartQR: 8 task vòng 1 + 7 task vòng 2

> Dùng bản `gfhg.zip` (bản mới nhất, đã qua cả 2 vòng vá). Test theo đúng thứ tự — một số test
> ở vòng 2 phụ thuộc trạng thái do test vòng 1 tạo ra.

---

## 0. CHUẨN BỊ MÔI TRƯỜNG

```bash
# 1. Cài đặt
cd fg   # thư mục gốc repo đã giải nén
npm install --workspaces --if-present
cd packages/database && npx prisma generate && npx prisma migrate deploy && cd ../..

# 2. Chạy PostgreSQL + Redis (nếu chưa có sẵn)
docker run -d --name sqr-pg -e POSTGRES_USER=smartqr -e POSTGRES_PASSWORD=1 -e POSTGRES_DB=smartqr -p 5432:5432 postgres:16
docker run -d --name sqr-redis -p 6379:6379 redis:7

# 3. Seed dữ liệu mẫu (nếu có script seed)
cd packages/database && npm run db:seed && cd ../..

# 4. Chạy API (terminal 1)
cd apps/api && npm run build && npm run start
# API chạy ở http://localhost:4000

# 5. Chạy web (terminal 2, không bắt buộc cho phần test API)
cd apps/web && npm run dev
# Web chạy ở http://localhost:3000
```

Công cụ cần có: `curl`, `redis-cli`, `psql` (hoặc `npx prisma studio` để xem DB bằng giao diện).

Tạo sẵn 1 tài khoản test và đăng nhập để lấy token dùng xuyên suốt:

```bash
curl -s -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"tester@smartqr.local","password":"Test1234!"}'

TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tester@smartqr.local","password":"Test1234!"}' | jq -r .token)
echo $TOKEN
```

(Nếu không có endpoint `register` public, tạo user thẳng qua `npx prisma studio` hoặc script Node dùng `PrismaClient`.)

---

# PHẦN A — VÒNG 1 (8 task)

## A1. Revocation hợp nhất Ticket + QR

**Mục tiêu:** một lần gọi `revoked-delta` phải thấy cả vé lẫn QR đã thu hồi.

1. Tạo 1 show, 1 vé (`ticket`), 1 rental + 1 API key thuê (`rentalId != null`), 1 external QR
   thuộc rental đó.
2. Thu hồi vé:
   ```bash
   curl -s -X POST http://localhost:4000/api/v1/shows/<showId>/tickets/<ticketId>/revoke \
     -H "Authorization: Bearer $TOKEN"
   ```
3. Thu hồi QR:
   ```bash
   curl -s -X POST http://localhost:4000/api/v1/qr/<qrId>/revoke \
     -H "Authorization: Bearer $TOKEN"
   ```
4. Gọi delta bằng key thuê API:
   ```bash
   curl -s http://localhost:4000/api/v1/gates/revoked-delta -H "x-api-key: $RENTAL_KEY"
   ```

**Kỳ vọng:** response `revoked` chứa cả 2 `jti` (vé và QR), field `resource_type` phân biệt đúng loại.

**Kiểm tra DB:**
```sql
SELECT resource_type, jti, tenant_id, show_id FROM revoked_resources ORDER BY revoked_at DESC LIMIT 5;
```
Phải thấy đúng 2 dòng mới, `tenant_id` của dòng ticket = `ownerId` của show, không phải `rentalId`.

---

## A2. Dual-secret QR JWT rollover

**Mục tiêu:** JWT ký bằng `JWT_SECRET` cũ vẫn verify được trong thời gian rollover, có log cảnh báo.

1. Ghi lại `QR_JWT_SECRET` hiện tại trong `.env`, tạm đổi tên biến đó thành `QR_JWT_SECRET_BAK`
   (xoá `QR_JWT_SECRET` khỏi `.env`) → restart API. Giờ `qrSecret` fallback về `JWT_SECRET`.
2. Tạo 1 vé, lấy `qr_jwt` của nó (qua API tạo vé hoặc DB).
3. Khôi phục `QR_JWT_SECRET` về giá trị cũ, restart API lần nữa — bây giờ vé vừa tạo được ký
   bằng `JWT_SECRET` (secret "cũ") nhưng hệ thống đang ưu tiên `QR_JWT_SECRET` (secret "mới").
4. Verify vé đó:
   ```bash
   curl -s -X POST http://localhost:4000/api/v1/verify \
     -H "x-api-key: $RENTAL_KEY" -H "Content-Type: application/json" \
     -d '{"qr_jwt":"<qr_jwt vừa lấy>"}'
   ```

**Kỳ vọng:** verify vẫn thành công (không lỗi `invalid_signature`), log server in ra dòng cảnh báo
`... matched legacy hash and was rehashed` hoặc tương đương cho nhánh QR (`verified with legacy JWT_SECRET`).

**Test âm:** đặt `QR_JWT_LEGACY_FALLBACK_UNTIL` là ngày hôm qua trong `.env`, restart, verify lại
vé cũ đó → phải bị từ chối (hạn rollover đã hết, đây cũng là test cho TASK B của vòng 2).

---

## A3. Bỏ nhận API key qua query string

```bash
curl -s "http://localhost:4000/api/v1/verify?api_key=$RENTAL_KEY" \
  -X POST -H "Content-Type: application/json" -d '{"ticket_code":"whatever"}'
```

**Kỳ vọng:** `401 Unauthorized` (key qua query string bị từ chối). Gọi lại với header
`x-api-key: $RENTAL_KEY` phải thành công (hoặc lỗi nghiệp vụ khác, không phải lỗi xác thực).

---

## A4. Soft-suspend key

```bash
# Suspend 24h
curl -s -X POST http://localhost:4000/api/v1/developer/keys/<keyId>/suspend \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"until":"'"$(date -u -d '+1 day' +%Y-%m-%dT%H:%M:%SZ)"'"}'

# Gọi verify bằng key đang suspend
curl -s -X POST http://localhost:4000/api/v1/verify -H "x-api-key: $RENTAL_KEY_RAW" \
  -H "Content-Type: application/json" -d '{"ticket_code":"x"}'
```

**Kỳ vọng:** verify trả `403` với `status: "suspended"`, **không phải** `401` như key đã revoke —
phân biệt rõ 2 trạng thái.

```bash
curl -s -X POST http://localhost:4000/api/v1/developer/keys/<keyId>/resume \
  -H "Authorization: Bearer $TOKEN"
```

**Kỳ vọng:** verify lại thành công ngay sau resume.

**Test tự động hết hạn:** suspend với `until` là 5 giây sau hiện tại, đợi 10 giây, gọi verify lại
mà **không** gọi resume → phải tự thành công (job hoặc lazy-check trong `getApiKey` tự mở lại).

---

## A5. Show scanner key — verify chặn chéo show

```bash
# Tạo key quét riêng cho show A
curl -s -X POST http://localhost:4000/api/v1/developer/shows/<showAId>/scanner-key \
  -H "Authorization: Bearer $TOKEN"
# Lưu api_key_once trả về làm $SHOW_A_KEY

# Dùng key show A verify vé của show B
curl -s -X POST http://localhost:4000/api/v1/verify -H "x-api-key: $SHOW_A_KEY" \
  -H "Content-Type: application/json" -d '{"qr_jwt":"<qr_jwt của vé show B>"}'
```

**Kỳ vọng:** `403 { error: "show_key_mismatch" }`.

```bash
# Dùng key show A verify external QR bất kỳ
curl -s -X POST http://localhost:4000/api/v1/verify -H "x-api-key: $SHOW_A_KEY" \
  -H "Content-Type: application/json" -d '{"qr_jwt":"<qr_jwt của 1 external QR>"}'
```

**Kỳ vọng:** `403 { error: "show_key_external_qr" }`.

Verify đúng vé show A bằng `$SHOW_A_KEY` → phải thành công bình thường.

---

## A6. TTL vé theo `endAt` show

1. Tạo show với `startAt` hôm nay, `endAt` = hôm nay + 2 giờ.
2. Tạo vé, lấy `qr_jwt`, decode bằng https://jwt.io hoặc:
   ```bash
   node -e "console.log(JSON.parse(Buffer.from('<qr_jwt phần giữa>','base64url').toString()))"
   ```
3. Kiểm tra field `exp` trong payload = `endAt + 24h` (tính bằng epoch giây), **không phải**
   `issuedAt + 30 ngày`.

---

## A7. Payment link ký HMAC, không sửa được `amount` qua URL

1. Tạo 1 link thanh toán demo, lấy `expires` + `x-payment-signature` (thường nằm trong URL trả về
   từ endpoint tạo đơn demo).
2. Gọi webhook với `amount` bị sửa khác đơn gốc nhưng giữ nguyên chữ ký:
   ```bash
   curl -s -X POST http://localhost:4000/webhooks/payos-demo \
     -H "x-payment-expires: $EXPIRES" -H "x-payment-signature: $SIG" \
     -H "Content-Type: application/json" \
     -d '{"order_id":"<id>","kind":"ticket","amount": 1}'
   ```

**Kỳ vọng:** chữ ký không còn cover `amount` nên **không** dùng test này để phá — thay vào đó test
đúng bài: gọi lại **cùng chữ ký, cùng order_id** hai lần trong vòng vài giây (test replay của TASK 8
vòng 2, xem mục B7 bên dưới) — vì bản thân chữ ký không chứa `amount` nữa nên sửa `amount` không
còn ý nghĩa tấn công (nó chỉ chứng minh `order_id` hợp lệ, số tiền đọc từ DB).

---

## A8. Audit log cho rotate/revoke/reveal (bản build từ vòng 1, trước khi vá `@Req()`)

*(Test này để xác nhận vấn đề đã có trong vòng 1 — bỏ qua nếu bạn test thẳng bản vòng 2, xem B6.)*

---

# PHẦN B — VÒNG 2 (7 task A→G)

## B1 (TASK A) — `.gitignore` và secret

```bash
cd fg
git log --all --full-history -- .env
git log --all --full-history -- apps/api/.env
```

**Nếu cả hai lệnh không trả dòng nào:** `.env` chưa từng vào git, không cần xoay secret.
**Nếu có commit:** coi `PAYOS_API_KEY`, `PAYOS_CHECKSUM`, mật khẩu trong `DATABASE_URL`, `JWT_SECRET`
là đã lộ — xoay toàn bộ trước khi làm bất kỳ test nào khác trong tài liệu này trên môi trường thật.

Kiểm tra `.gitignore` đang chặn đúng:
```bash
git check-ignore -v .env apps/api/.env node_modules dist
```
Mỗi dòng phải in ra rule tương ứng (nghĩa là bị ignore). Không có output = đang lộ.

---

## B2 (TASK B) — Đồng hồ rollover tuyệt đối, không tự gia hạn khi restart

**Đây là test quan trọng nhất — bug gốc chỉ lộ ra khi RESTART, không lộ khi chạy liên tục.**

1. Trong `.env`, xoá cả `QR_JWT_LEGACY_FALLBACK_UNTIL` lẫn `API_KEY_PEPPER_ROLLOVER_UNTIL`
   (để trống hoặc comment), chỉ giữ `*_DAYS=30`.
2. Restart API, ghi lại giờ khởi động.
3. Sửa file `apps/api/src/generated/build-timestamp.ts` thủ công thành ngày 40 ngày trước:
   ```ts
   export const BUILD_TIMESTAMP = "2026-08-08T00:00:00.000Z";
   ```
4. Restart API lần nữa **mà không chạy `npm run build`** (để giữ nguyên file vừa sửa tay,
   vì `prebuild` sẽ ghi đè timestamp mới nếu build lại — chỉ chạy `node dist/main.js` trực tiếp
   nếu `dist/` đã build sẵn từ trước khi sửa `generated/build-timestamp.ts`, hoặc sửa file
   nguồn `.ts` trong `src/` rồi build 1 lần, sau đó sửa thẳng file đã build trong `dist/generated/`
   để tránh bị `prebuild` ghi đè).
5. Verify 1 vé ký bằng `JWT_SECRET` (legacy) hoặc gọi API bằng key băm với `API_KEY_PEPPER_PREVIOUS`.

**Kỳ vọng:** vì `BUILD_TIMESTAMP` giả lập là 40 ngày trước, quá hạn 30 ngày → fallback **phải bị từ chối**
ngay ở lần khởi động này, chứ không "tự gia hạn thêm 30 ngày kể từ giờ" như hành vi lỗi ban đầu.

**Kiểm tra log khởi động:** phải thấy đúng 1 dòng
`Legacy rollover dates are not absolute; configure *_UNTIL to avoid reset on redeploy.`

**Test đối chứng (đúng cách dùng):** đặt `API_KEY_PEPPER_ROLLOVER_UNTIL="2026-10-30"` (tương lai xa),
restart nhiều lần → mỗi lần restart hạn vẫn là `2026-10-30`, không đổi. Đặt về ngày quá khứ →
key pepper cũ bị từ chối ngay, không phụ thuộc restart bao nhiêu lần.

---

## B3 (TASK C) — Tách đồng hồ SHA-256 trần khỏi đồng hồ pepper

1. Đặt `API_KEY_PEPPER_ROLLOVER_UNTIL` là ngày quá khứ (hạn pepper-rollover đã hết),
   **không đặt** `API_KEY_LEGACY_SHA256_UNTIL`. Restart.
2. Tạo 1 API key kiểu cũ — băm thẳng bằng `SHA-256(rawKey)` (không HMAC), insert thẳng vào DB:
   ```sql
   -- rawKey ví dụ "sq_live_manualtest123"
   -- hash = sha256("sq_live_manualtest123") tính bằng: echo -n "sq_live_manualtest123" | sha256sum
   INSERT INTO api_keys (id, user_id, key_hash, prefix, quota, scopes, rate_limit, status, created_at)
   VALUES (gen_random_uuid(), '<userId>', '<hash vừa tính>', 'sq_live_manual', 100, ARRAY['ticket:verify'], 60, 'active', now());
   ```
3. Gọi verify bằng `x-api-key: sq_live_manualtest123`.

**Kỳ vọng:** vẫn xác thực được (nhánh SHA-256 trần không có hạn khi chưa đặt biến), **và** đồng thời
key băm bằng `API_KEY_PEPPER_PREVIOUS` (nếu có test song song từ B2) đã bị từ chối — chứng minh
2 cơ chế độc lập nhau thật, không còn dùng chung 1 cờ `rolloverActive`.

**Kiểm tra Redis:**
```bash
redis-cli KEYS "apikey:legacy-hash:count:*"
```
Phải thấy 2 dòng riêng theo ngày: `...count:sha256:<date>` và `...count:previous:<date>`
(tùy nhánh nào vừa được gọi), không gộp chung.

---

## B4 (TASK D) — Counter không còn lộ ở endpoint public

```bash
curl -s http://localhost:4000/api/v1/status | jq .
```
**Kỳ vọng:** response **không** chứa field `legacy_key_hash_hits_today` hay bất kỳ field
`legacy_*` nào.

```bash
ADMIN_TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" -d '{"email":"<admin email>","password":"<mật khẩu admin>"}' | jq -r .token)

curl -s http://localhost:4000/api/v1/admin/summary -H "Authorization: Bearer $ADMIN_TOKEN" | jq .legacy_api_key_hashes
```
**Kỳ vọng:** trả `{ "previous_hits_today": <số>, "sha256_hits_today": <số> }`, khớp với số liệu
Redis xem ở B3. Gọi lại **không kèm token** → `401`.

---

## B5 (TASK E) — Chạy bộ test tích hợp show-scope tự động

```bash
cd apps/api
TEST_DATABASE_URL="postgresql://smartqr:1@localhost:5432/smartqr?schema=public" \
  npm run test:integration
```

**Kỳ vọng:** toàn bộ pass, đặc biệt file `test/show-scope.integration.mjs` — output phải hiện
`# pass 1` (hoặc tương đương) không có `not ok`. Nếu muốn test tay thủ công thêm ngoài script này,
lặp lại các bước ở mục A5 (đã cover phần lớn) và bổ sung: gửi `usage-events` với 1 mảng gồm
**cả** event hợp lệ lẫn event `out_of_show_scope` trong cùng 1 request, xác nhận response tách
đúng `accepted_count` và `rejected` — không phải tất cả bị từ chối chỉ vì 1 phần tử sai phạm vi.

---

## B6 (TASK F) — Rotate show scanner key qua UI

1. Vào `http://localhost:3000/dashboard/shows`, tìm show đã có key quét (từ test A5).
2. Bấm "Xoay key quét" → nhập mật khẩu, để `grace_minutes` mặc định 60 → Xoay key.

**Kỳ vọng:** hộp key mới hiện ra đúng 1 lần, đồng hồ đếm ngược chạy giảm dần từ ~60:00.
Copy key mới, verify vé bằng key **cũ** (`$SHOW_A_KEY` từ A5) và key **mới** cùng lúc trong
60 phút ân hạn — cả hai phải verify được.

3. Đợi hết 60 phút (hoặc test nhanh: gọi rotate với `grace_minutes: 1`, đợi > 60 giây), verify
   lại bằng key cũ.

**Kỳ vọng:** key cũ bị từ chối (`401`, đã chuyển `status: revoked`), key mới vẫn hoạt động.

**Test giới hạn nhập:** thử nhập `grace_minutes = 0` và `1500` trên UI → phải bị chặn ngay ở
client, không gửi request. Gọi thẳng API với giá trị đó (bỏ qua UI) → server phải trả `400`.

**Test rotate không có mật khẩu:**
```bash
curl -s -X POST http://localhost:4000/api/v1/developer/keys/<showKeyId>/rotate \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
```
**Kỳ vọng:** `400` (thiếu `password`, do class-validator `@IsString()` bắt buộc).

---

## B7 (TASK G) — CSRF race condition và payment demo flag

**CSRF:**
```js
// Chạy trong console trình duyệt tại http://localhost:3000 sau khi đăng nhập
Promise.all([
  fetch("http://localhost:4000/api/v1/developer/keys/xxx", { method: "PATCH", credentials: "include",
    headers: { "Content-Type": "application/json" }, body: "{}" }),
  fetch("http://localhost:4000/api/v1/developer/keys/yyy", { method: "PATCH", credentials: "include",
    headers: { "Content-Type": "application/json" }, body: "{}" })
]).then(rs => Promise.all(rs.map(r => r.status)))
```
Cách chính xác hơn: mở tab Network, bấm liên tiếp thật nhanh 3-4 hành động mutate trên dashboard
(đổi tên key, đổi quota, v.v.) trong vòng 1 giây.

**Kỳ vọng:** không có request nào trả `403 csrf_invalid`. Xem tab Network, chỉ có **đúng 1** request
gọi `GET /api/csrf-token` dù có nhiều mutation cùng lúc.

**Test tự phục hồi:** xoá cookie `csrf_token` bằng DevTools → Application → Cookies, sau đó bấm
1 mutation bất kỳ trên UI.

**Kỳ vọng:** không thấy lỗi hiển thị cho người dùng — request tự lấy token mới và thành công
(có thể thấy 2 request trong Network: 1 lần đầu 403, ngay sau đó 1 lần lấy token mới rồi retry).

**Payment demo:**
```bash
# .env dev đã có PAYMENT_DEMO_MODE=true
curl -s -X POST http://localhost:4000/webhooks/payos-demo \
  -H "x-payment-expires: <giá trị đúng>" -H "x-payment-signature: <chữ ký đúng>" \
  -H "Content-Type: application/json" -d '{"order_id":"<id>","kind":"ticket"}'
```
**Kỳ vọng:** thành công (không còn `403 demo_payment_disabled` như log lỗi trước khi thêm biến env).

Gọi lại **y hệt** request trên (cùng `expires`, cùng `signature`) lần thứ 2 ngay sau đó:

**Kỳ vọng:** `401 payment_link_replayed` — xác nhận chống replay đã thêm ở TASK 8 hoạt động.

Set `NODE_ENV=production PAYMENT_DEMO_MODE=true` rồi khởi động API:

**Kỳ vọng:** app từ chối khởi động ngay, log lỗi liệt kê `PAYMENT_DEMO_MODE must be false or unset in production`.

---

## B8 — Kiểm tra bổ sung: fix ngoài yêu cầu (revoked-delta cho key thuê API)

Test này xác nhận fix tự phát hiện của Copilot (không nằm trong 2 prompt, nhưng cần test vì
đụng vào logic cốt lõi):

1. Dùng đúng key thuê API (`rentalId != null`) đã tạo ở A1.
2. Thu hồi 1 vé của show **bất kỳ** thuộc cùng user sở hữu rental đó.
3. Gọi `revoked-delta` bằng key thuê API.

**Kỳ vọng:** thấy `jti` của vé vừa thu hồi trong response (trước bản vá vòng 2, mục này **sẽ thất bại**
— nếu bạn có bản build cũ hơn để so sánh, chạy lại test này trên bản đó để thấy rõ khác biệt).

---

## TỔNG KẾT — BẢNG THEO DÕI

| # | Task | Cách test | Kết quả |
|---|---|---|---|
| A1 | Revocation hợp nhất | curl + SQL | ☐ |
| A2 | Dual-secret QR | tạm đổi env, verify | ☐ |
| A3 | Bỏ api_key qua query | curl | ☐ |
| A4 | Soft-suspend | curl suspend/resume | ☐ |
| A5 | Show key chặn chéo | curl verify | ☐ |
| A6 | TTL vé theo endAt | decode JWT | ☐ |
| A7 | Payment link HMAC | curl webhook | ☐ |
| B1 | .gitignore + secret | git log | ☐ |
| B2 | Đồng hồ tuyệt đối | sửa build-timestamp, restart | ☐ |
| B3 | Tách đồng hồ sha256 | insert key thủ công | ☐ |
| B4 | Counter không lộ | curl /status vs /admin/summary | ☐ |
| B5 | Test tự động show-scope | npm run test:integration | ☐ |
| B6 | Rotate show key UI | thao tác UI + curl | ☐ |
| B7 | CSRF race + demo replay | console browser + curl | ☐ |
| B8 | Fix revoked-delta rental | curl + SQL | ☐ |

Test nào fail, ghi lại **request/response đầy đủ + log server tại thời điểm đó** — gửi lại cho tôi
để tôi đối chiếu với code, không cần đoán nguyên nhân trước.
