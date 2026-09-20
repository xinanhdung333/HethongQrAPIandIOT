# PROMPT CHO GITHUB COPILOT AGENT — SmartQR: vá 7 lỗ hổng kiến trúc khoá & xác thực

> Copy toàn bộ file này vào Copilot Chat (chế độ Agent / Edits) ở thư mục gốc repo.
> Nếu Copilot bị giới hạn context, chạy từng TASK một, theo đúng thứ tự P0 → P2.

---

## 0. BỐI CẢNH DỰ ÁN (đọc trước khi sửa bất cứ dòng nào)

Monorepo SmartQR:

```
apps/api/            NestJS 10 + Prisma 5 + Redis (ioredis) + jsonwebtoken
apps/web/            Next.js App Router (TypeScript)
packages/database/   Prisma schema + migrations SQL thủ công
packages/sdk*/       SDK JS / PHP / Python
```

Kiến trúc xác thực hiện tại:

- **Người dùng web**: `Authorization: Bearer <JWT>`, token lưu trong `localStorage` (`smartqr_token`).
  **Server KHÔNG set bất kỳ session cookie nào** (đã grep `res.cookie` — chỉ có cookie `csrf_token`).
- **Tích hợp bên thứ ba**: header `x-api-key` → `ApiKeyGuard` → `AuthService.getApiKey()`.
- **Cổng quét (gate)**: dùng API key scope `ticket:verify`, gọi `/api/v1/gates/*`.
- **Vé & QR ngoài**: JWT HS256 ký bằng `QR_JWT_SECRET` (fallback `JWT_SECRET` trong thời gian rollover).
- **Thu hồi**: bảng chung `RevokedResource { resourceType, jti, revokedAt, tenantId, isTest, userId }`,
  unique `(resourceType, jti)`.

Quy ước tenant (`apps/api/src/security/tenant.ts`):

```ts
resolveTenantId(key) = key.rentalId ?? key.userId
```

Ba loại API key cùng tồn tại:

| Loại | `rentalId` | `showId` | Scope điển hình |
|---|---|---|---|
| Key thuê API | có | null | `qr:create`, `qr:read`, `ticket:verify` |
| Key quét show | null | có | chỉ `ticket:verify` |
| Key user cũ (legacy) | null | null | đủ scope |

### Ràng buộc bắt buộc

1. **KHÔNG được làm chết API key / vé / QR đang lưu hành.** Mọi thay đổi định dạng hash hoặc secret
   phải có đường tương thích ngược (như `legacyHashApiKey` và `legacyQrSecret` đang làm).
2. **KHÔNG sửa file migration cũ.** Mỗi thay đổi schema tạo thư mục mới
   `packages/database/prisma/migrations/<YYYYMMDDHHmmss>_<ten_snake_case>/migration.sql`,
   kèm `rollback.sql` nếu migration có DDL phá huỷ.
3. **KHÔNG đưa secret thật vào `.env.example`, README, hay comment.** Chỉ đặt placeholder.
4. Giữ nguyên code style hiện có: Nest DI qua constructor, không thêm thư viện mới nếu `crypto`/`ioredis`
   đã đủ. **Không thêm dependency** nào ngoài những gì đã có trong `apps/api/package.json`.
5. Mỗi TASK là **một commit riêng**, message theo dạng `fix(api): <mô tả>`.
6. Sau mỗi TASK chạy: `cd apps/api && npm run build` — phải pass sạch TypeScript.

---

## P0 — TASK 1: Bổ sung biến môi trường còn thiếu (làm đầu tiên, chặn deploy)

### Vấn đề

`apps/api/.env.example` đã khai báo `QR_JWT_SECRET`, `API_KEY_PEPPER`, `PAYMENT_LINK_SECRET`,
nhưng file `.env` đang dùng thực tế chỉ có `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `WEB_ORIGIN`,
`NEXT_PUBLIC_*`, `PAYOS_*`. Hệ quả:

- `AuthService.qrSecret` fallback về `JWT_SECRET` → việc tách secret QR **chưa có hiệu lực**.
- `apiKeyPepper()` **throw ngay lúc khởi động khi `NODE_ENV=production`** → API chết.
- `secret-box.ts` cũng fallback về `JWT_SECRET` khi thiếu `API_SECRET_ENCRYPTION_KEY`.

### Yêu cầu

1. Tạo `apps/api/src/config/env-validation.ts`, export `validateEnv()`:
   - Ở `NODE_ENV=production`, **throw với thông báo gộp toàn bộ biến thiếu trong một lần**
     (không throw từng biến một) nếu thiếu bất kỳ biến nào sau:
     `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `QR_JWT_SECRET`, `API_KEY_PEPPER`,
     `API_SECRET_ENCRYPTION_KEY`, `PAYMENT_LINK_SECRET`, `PAYOS_WEBHOOK_SECRET`, `WEB_ORIGIN`.
   - Thêm kiểm tra chất lượng, cũng chỉ ở production:
     `JWT_SECRET`, `QR_JWT_SECRET`, `API_KEY_PEPPER`, `PAYMENT_LINK_SECRET` phải dài ≥ 32 ký tự;
     `QR_JWT_SECRET !== JWT_SECRET` (nếu bằng nhau thì việc tách secret là vô nghĩa — throw).
   - Ở môi trường dev: **không throw**, chỉ `Logger.warn()` liệt kê biến thiếu và cho biết đang dùng
     giá trị dev mặc định nào.
2. Gọi `validateEnv()` trong `apps/api/src/main.ts` **ngay dòng đầu hàm `bootstrap()`**,
   trước `NestFactory.create`.
3. Cập nhật `apps/api/.env.example`: bổ sung `API_SECRET_ENCRYPTION_KEY`, `PAYOS_WEBHOOK_SECRET`,
   `API_KEY_PEPPER_PREVIOUS` (xem TASK 2) nếu chưa có, kèm comment một dòng giải thích mục đích
   và hậu quả khi mất từng secret.
4. Tạo `docs/SECRETS.md` liệt kê bảng: tên biến | dùng ở đâu | cách sinh
   (`openssl rand -hex 32`) | hậu quả khi mất | có xoay vòng được không.

### Tiêu chí nghiệm thu

- `NODE_ENV=production` + thiếu biến → app không khởi động, log liệt kê **đầy đủ** biến thiếu.
- `NODE_ENV=production` + `QR_JWT_SECRET === JWT_SECRET` → throw.
- Dev không có `.env` đầy đủ → app vẫn chạy, chỉ có warning.
- **Không sửa file `.env`** trong repo (đã nằm trong `.gitignore`).

---

## P0 — TASK 2: Xoay vòng được `API_KEY_PEPPER` (dual-pepper)

### Vấn đề

`apps/api/src/security/auth.service.ts`:

```ts
hashApiKey(apiKey: string) {
  return crypto.createHmac("sha256", this.apiKeyPepper()).update(apiKey).digest("hex");
}
private legacyHashApiKey(apiKey: string) {
  return crypto.createHash("sha256").update(apiKey).digest("hex");   // SHA-256 trần, thời kỳ trước
}
```

Đường tương thích hiện có chỉ đi **một chiều: SHA-256 trần → HMAC(pepper hiện tại)**.
Không có cách nào xoay `API_KEY_PEPPER` sang giá trị mới: đổi pepper là **toàn bộ API key chết đồng loạt**,
không có đường phục hồi. Trong khi đó QR secret đã có mô hình dual-secret rất tốt
(`qrSecret` + `legacyQrSecret` + `QR_JWT_LEGACY_FALLBACK_DAYS`) — hãy áp dụng đúng mô hình đó.

### Yêu cầu

1. Thêm `API_KEY_PEPPER_PREVIOUS` (tuỳ chọn) và `API_KEY_PEPPER_ROLLOVER_DAYS` (mặc định `30`).
2. Trong `getApiKey()`, thứ tự dò hash phải là:
   1. HMAC với `API_KEY_PEPPER` (hiện tại) — đường nóng, không log gì.
   2. HMAC với `API_KEY_PEPPER_PREVIOUS` (nếu có **và** còn trong hạn rollover).
   3. SHA-256 trần (legacy cũ nhất).
   Khi khớp ở bước 2 hoặc 3 → **rehash lười**: `update({ keyHash: <hash pepper hiện tại> })`,
   giữ nguyên hành vi hiện tại.
3. Mỗi lần rơi vào bước 2 hoặc 3, ghi cảnh báo nhưng **chống spam log**: dùng đúng kỹ thuật đã áp dụng
   cho `verifyQrJwt` — khoá Redis `apikey:legacy-hash:<keyId>:<YYYY-MM-DDTHH>`, TTL 3600s,
   chỉ `logger.warn` khi `setIfAbsent` thành công. Nội dung log chỉ chứa `key.id` và `key.prefix`,
   **tuyệt đối không chứa raw key hay hash**.
4. Hết hạn rollover → bỏ qua bước 2 và 3, key cũ bị từ chối như key không hợp lệ.
5. Thêm counter để biết khi nào tắt được fallback: mỗi lần dùng nhánh legacy,
   `INCR` khoá Redis `apikey:legacy-hash:count:<YYYY-MM-DD>` (TTL 40 ngày).
   Expose ở `GET /api/v1/status` (`apps/api/src/modules/status.controller.ts`) dưới dạng
   `legacy_key_hash_hits_today` để vận hành biết còn key cũ nào đang chạy không.
6. Viết `docs/RUNBOOK-pepper-rotation.md`: quy trình 5 bước xoay pepper
   (đặt `PREVIOUS` = pepper cũ → deploy pepper mới → theo dõi counter về 0 → gỡ `PREVIOUS` → deploy).

### Tiêu chí nghiệm thu

- Key băm bằng pepper cũ vẫn xác thực được trong thời gian rollover và **được rehash sau lần gọi đầu tiên**
  (lần gọi thứ hai khớp ngay ở bước 1).
- Sau khi hết hạn rollover, key pepper cũ bị từ chối.
- Log không lặp lại quá 1 lần/giờ/key.

---

## P0 — TASK 3: Ép phạm vi `showId` ở gate sync

### Vấn đề — đây là lỗ hổng phân quyền thật, không phải chỉ là dọn dẹp

`apps/api/src/services/platform.service.ts` **đã** chặn key quét show đụng vào tài nguyên ngoài show:

```ts
if (key?.showId) throw new ForbiddenException({ error: "show_key_external_qr", ... });
if (key && key.showId && key.showId !== ticket.showId) throw new ForbiddenException({ error: "show_key_mismatch", ... });
```

Nhưng `apps/api/src/services/gate-sync.service.ts` **không hề biết đến `showId`**. Nó chỉ dùng
`resolveTenantId(key)` → `key.userId` (vì key quét show có `rentalId = null`). Hậu quả:

- `GET /api/v1/gates/revoked-delta` trả về **toàn bộ** revocation của chủ sở hữu:
  vé của các show khác **và** external QR — rò rỉ jti sang ngoài phạm vi show.
- `POST /api/v1/gates/usage-events` cho phép key quét show A gửi
  `{ resource_type: "external_qr", jti: ... }` và **đánh dấu đã dùng** QR của chủ sở hữu,
  hoặc đánh dấu vé của show B. Đây là nâng quyền ghi, không chỉ là đọc.

Tức là hàng rào dựng ở đường verify online nhưng để hở hoàn toàn ở đường sync offline.

### Yêu cầu

Sửa `apps/api/src/services/gate-sync.service.ts`. Đổi `IntegrationKey` thành
`ApiKey & { rental: ApiRentalOrder | null }` có tính đến `showId` (trường đã có sẵn trong Prisma model).

1. **`revokedDelta(key, since)`** — khi `key.showId != null`:
   - Chỉ trả `resourceType = "ticket"`, **không bao giờ** trả `external_qr`.
   - Chỉ trả jti của vé thuộc đúng show đó. Vì bảng `RevokedResource` không có cột `showId`,
     dùng một trong hai cách, ưu tiên cách (a):
     - **(a)** Thêm cột `showId String?` (nullable) vào `RevokedResource` + migration mới
       `packages/database/prisma/migrations/<ts>_add_revoked_resource_show_id/migration.sql`:
       `ALTER TABLE "revoked_resources" ADD COLUMN "show_id" TEXT;`
       + index `("show_id", "revoked_at")`.
       Backfill bằng `UPDATE ... FROM "tickets" WHERE resource_type = 'ticket' AND jti = tickets.jti`.
       Cập nhật `platform.service.ts:revokeTicket()` để ghi `showId: ticket.showId` khi tạo/upsert.
     - **(b)** Nếu không muốn đổi schema: join qua `prisma.ticket.findMany({ where: { showId, jti: { in: [...] } } })`
       để lọc. Chấp nhận thêm một truy vấn, nhưng **phải giữ giới hạn `take: 5000`** và lọc sau khi join.
   - Khi `key.showId == null`: giữ nguyên hành vi hiện tại, không đổi gì.
2. **`reportUsageEvents(key, events)`** — khi `key.showId != null`:
   - Từ chối ngay toàn bộ request nếu có bất kỳ event nào `resource_type === "external_qr"`:
     `ForbiddenException({ error: "show_key_external_qr", message: "Scanner key chỉ được đồng bộ vé của show" })`.
   - `markUsedInDb()` phải thêm điều kiện `showId: key.showId` vào `tenantTicketWhere()`
     thay vì chỉ `{ show: { ownerId: key.userId } }`.
   - Event trỏ tới vé của show khác thì **không** ném lỗi toàn request (gate offline gửi theo lô),
     mà trả về trong mảng mới `rejected: [{ jti, reason: "out_of_show_scope" }]`.
     Cập nhật kiểu trả về và `packages/sdk/src/index.d.ts` cho khớp.
3. **`listConflicts(key)`** — khi `key.showId != null`, chỉ quét namespace ticket
   (`gate:conflict:${key.userId}:*` với resource ticket), bỏ nhánh external_qr.
4. Giữ nguyên `gateRedisTenantId()` — **không đổi khoá Redis**, nếu không sẽ mất trạng thái
   "đã dùng" của các vé đang lưu hành.

### Tiêu chí nghiệm thu

Viết test tích hợp `apps/api/test/show-scope.integration.mjs` (chạy `npm run test:integration`), phủ:

- Key show A gọi `revoked-delta` → không thấy jti vé show B, không thấy external QR.
- Key show A gửi `usage-events` với `resource_type: "external_qr"` → 403.
- Key show A gửi event là vé show B → nằm trong `rejected`, và **DB của vé show B không đổi**
  (`isUsed` vẫn `false`).
- Key thuê API (`rentalId != null`, `showId = null`) → hành vi **không thay đổi so với trước**.

---

## P1 — TASK 4: Cho phép rotate key quét show

### Vấn đề

`apps/api/src/services/developer.service.ts:rotate()` chặn ngay đầu hàm:

```ts
if (!old.rentalId) throw new BadRequestException({ error: "missing_rental", ... });
```

Còn `api-key-issuance.service.ts` từ chối tạo key thứ hai cho show đã có key active:

```ts
if (existing) throw new ForbiddenException({ error: "show_scan_key_exists", ... });
```

Kết quả: key máy quét bị lộ **giữa đêm diễn** thì lối duy nhất là revoke rồi tạo mới —
mọi máy quét chết trong khoảng giữa. Đúng lúc không được phép chết.

### Yêu cầu

1. Mở `rotate()` cho nhánh `showId`: nếu `old.showId != null`, đặt key cũ
   `status: "deprecated"` + `revokeAt = now + GRACE`, rồi phát hành key mới cùng `showId`, cùng scope.
   - `GRACE` cho show key = **60 phút** (không phải 7 ngày như key thuê API) —
     đủ để nạp key mới vào các máy quét, đủ ngắn để giới hạn thiệt hại khi lộ.
     Đặt hằng số có tên rõ ràng, không dùng magic number.
   - Cho phép truyền `grace_minutes` (1–1440) trong body để vận hành tự quyết; validate chặt.
2. `issueKey()`: điều kiện `show_scan_key_exists` chỉ tính key `status: "active"`,
   **không tính `"deprecated"`** — nếu không rotate sẽ tự chặn chính nó.
   Song song đó, ràng buộc không quá **1 active + 1 deprecated** mỗi show.
3. `rotate()` vẫn **giữ nguyên yêu cầu nhập mật khẩu** (`requirePassword`) — không nới lỏng.
4. Ghi activity log `ROTATE_SHOW_SCAN_KEY` với metadata `{ showId, replacementKeyId, graceMinutes }`.
5. UI `apps/web/src/app/dashboard/shows/page.tsx`: thêm nút "Xoay key quét",
   hiện `api_key_once` **đúng một lần** kèm cảnh báo, và hiển thị đồng hồ đếm ngược tới `revokeAt`
   của key cũ.

### Tiêu chí nghiệm thu

- Trong thời gian grace, **cả key cũ và key mới đều verify vé được**.
- Hết grace, job `maintainRotatedKeys` chuyển key cũ sang `revoked`; key cũ bị từ chối.
- Rotate không kèm mật khẩu → 403.

---

## P1 — TASK 5: Sửa lỗi đua CSRF ở frontend (và thu hẹp phạm vi middleware)

### Vấn đề

`apps/web/src/lib/api.ts` hiện gọi `GET /api/csrf-token` **trước mỗi mutation**, và
`apps/api/src/modules/security.controller.ts` **mint token mới ghi đè cookie mỗi lần được gọi**:

```ts
const token = randomBytes(32).toString("hex");
response.cookie("csrf_token", token, { ... });
```

Hai mutation chạy song song → request gửi trước cầm token đã bị request sau ghi đè → `403 csrf_invalid`.
Ngoài ra mỗi mutation tốn thêm một round-trip.

Cần nói rõ để không kỳ vọng sai: lớp CSRF này **hiện không chặn được cuộc tấn công nào**, vì
xác thực đi bằng `Authorization: Bearer` từ `localStorage` — request cross-site không tự gắn được header đó —
và `CsrfMiddleware` lại miễn trừ toàn bộ `/api/v1/*`, trong đó có chính các endpoint nhạy cảm nhất
(`/api/v1/developer/keys/:id/rotate|revoke|suspend|resume`, `/api/v1/developer/rentals/:id/secrets/reveal`).
Vì vậy **không mở rộng CSRF sang `/api/v1/*`** — làm thế chỉ khiến mọi SDK và máy quét gãy mà không đổi lấy
bảo mật gì. Việc cần làm là giữ lớp này rẻ, đúng, và không tự gây lỗi.

### Yêu cầu

1. **Server** (`security.controller.ts`): nếu request đã có cookie `csrf_token` hợp lệ
   (hex, đúng 64 ký tự) thì **trả lại chính token đó**, không mint mới. Chỉ mint khi chưa có hoặc sai định dạng.
2. **Client** (`apps/web/src/lib/api.ts`):
   - Cache token trong biến module-level.
   - Dùng **một promise dùng chung** (single-flight) để nhiều mutation song song chỉ kích hoạt
     đúng một lần fetch token, cùng chờ chung kết quả.
   - Chỉ fetch lại khi chưa có token, hoặc khi nhận `403` với body `error === "csrf_invalid"` —
     khi đó **xoá cache, lấy token mới và retry đúng một lần**; lần hai thất bại thì ném lỗi thật.
   - Giữ nguyên `credentials: "include"`.
3. `CsrfMiddleware`: giữ nguyên danh sách `PUBLIC_PREFIXES`. Thêm comment ở đầu file nêu rõ
   phạm vi bảo vệ thực tế và lý do `/api/v1/*` được miễn trừ, để người sau không tưởng lầm là thiếu sót.
4. Thêm `docs/ADR-csrf.md` ngắn (≤ 1 trang): tại sao giữ lớp này, nó chặn gì và không chặn gì,
   điều kiện nào thì nên gỡ bỏ hẳn (ví dụ: nếu chuyển session sang cookie thì phải mở rộng, ngược lại có thể bỏ).

### Tiêu chí nghiệm thu

- Bắn 5 mutation song song từ dashboard → **không có request nào 403**, và chỉ có **1** lần gọi `/api/csrf-token`.
- Xoá thủ công cookie `csrf_token` giữa phiên → mutation kế tiếp tự phục hồi, người dùng không thấy lỗi.

---

## P1 — TASK 6: Audit log cho hành động nhạy cảm phải có IP và user-agent

### Vấn đề

`ActivityLogService.record()` đã hỗ trợ `ip`, `userAgent`, `method`, `path` — nhưng chỉ khi được truyền `req`:

```ts
ip: this.clientIp(input.req),
userAgent: input.req?.get("user-agent"),
```

`apps/api/src/modules/developer.controller.ts` **không inject `@Req()`** ở bất kỳ endpoint nào.
Nên đúng những hành động cần điều tra nhất lại là những hành động **thiếu IP và thiết bị**:
`ROTATE_API_KEY`, `REVOKE_API_KEY`, `SUSPEND_API_KEY`, `RESUME_API_KEY`,
`ROTATE_RENTAL_SECRET`, `REVEAL_RENTAL_SECRETS`.

### Yêu cầu

1. Thêm `@Req() req: Request` vào 6 endpoint trên trong `developer.controller.ts`,
   truyền xuống `DeveloperService` và vào `activity.record({ ..., req })`.
   Đổi chữ ký `DeveloperService` tương ứng (thêm tham số `req?: Request` ở cuối, giữ optional
   để không phá các chỗ gọi khác).
2. Rà `apps/api/src/modules/admin.controller.ts` và `settings-payments.controller.ts`,
   áp dụng cùng nguyên tắc cho mọi action liên quan tới key/secret/payout.
3. Thêm `GET /api/v1/developer/security-events` (yêu cầu đăng nhập, chỉ trả log của chính user đó):
   lọc `ActivityLog` theo tập action nhạy cảm, hỗ trợ `from`, `to`, `action`, `page` (50/trang),
   trả kèm `ip`, `userAgent`, `createdAt`.
   **Không** trả `metadata` thô nếu trong đó có thể chứa giá trị nhạy cảm — lọc allowlist khoá metadata.
4. UI: thêm tab "Nhật ký bảo mật" trong `apps/web/src/app/dashboard/api-keys/page.tsx`
   dùng endpoint trên.
5. Bảo đảm **không bao giờ** log raw API key, secret đã giải mã, hay mật khẩu xác thực lại.
   Rà lại `revealSecrets()` — chỉ log **sự kiện đã xem**, không log **giá trị đã xem**.

### Tiêu chí nghiệm thu

- Gọi rotate qua proxy có `X-Forwarded-For` → log lưu đúng IP đầu chuỗi (hàm `clientIp` đã xử lý, chỉ cần truyền `req`).
- `security-events` không trả về log của user khác (viết test).

---

## P2 — TASK 7: Đưa ngưỡng cảnh báo quota-burst vào system settings

### Vấn đề — hai cơ chế cảnh báo, hai nơi cấu hình

`apps/api/src/services/api-maintenance.service.ts`:

- `enqueueQuotaWarnings()` đọc ngưỡng từ **system settings** (`settings.quota_warning_thresholds`) → admin chỉnh được trong UI.
- `enqueueQuotaBurstWarnings()` đọc từ **biến môi trường** `API_QUOTA_BURST_WINDOW_MINUTES`, `API_QUOTA_BURST_PERCENT` → muốn đổi ngưỡng phải deploy lại.

Cảnh báo burst chính là tín hiệu sớm của việc key bị lộ. Đúng lúc cần siết ngưỡng gấp thì lại là lúc phải chờ deploy.

### Yêu cầu

1. Trong `apps/api/src/services/system-settings.service.ts`, thêm vào khối `apiPlatform()`:
   `quota_burst = { window_minutes: number; threshold_percent: number; enabled: boolean }`,
   mặc định `{ 15, 10, true }`.
2. `enqueueQuotaBurstWarnings()` đọc từ settings; **giữ env var làm fallback** khi settings chưa có giá trị
   (để không đổi hành vi khi deploy lần đầu). Thứ tự: settings → env → mặc định cứng.
3. `enabled: false` → bỏ qua hoàn toàn nhánh burst.
4. Thêm ô nhập trong `apps/web/src/app/admin/admin-console.tsx`, validate:
   `window_minutes` 1–1440, `threshold_percent` 1–100.
5. Ghi activity log `UPDATE_QUOTA_BURST_SETTINGS` (có `req`) khi admin đổi giá trị.

---

## P2 — TASK 8: Ghi chú rủi ro luồng thanh toán demo (không sửa logic, chỉ chặn production)

### Vấn đề

`apps/api/src/modules/webhooks.controller.ts` — nhánh payment-link **bỏ qua toàn bộ** kiểm tra
nonce / timestamp / replay của nhánh PayOS:

```ts
if (paymentExpires && paymentSignature) {
  this.verifyPaymentLink(dto.order_id, dto.kind, paymentExpires, paymentSignature);  // không có replay guard
} else {
  await this.verifyPayosDemo(...);  // có nonce + Redis setIfAbsent
}
```

Chữ ký HMAC chỉ chứng minh **link là thật**, không chứng minh **đã trả tiền**.
Người giữ link checkout gọi thẳng webhook là đơn hàng thành `PAID`, lặp lại được nhiều lần trong 30 phút.
Với luồng demo thì chấp nhận được — vấn đề là nó **không có rào nào ngăn lọt lên production**.

### Yêu cầu

1. Thêm cờ `PAYMENT_DEMO_MODE` (mặc định `false`).
   Nhánh `paymentExpires && paymentSignature` chỉ chạy khi
   `PAYMENT_DEMO_MODE === "true"` **và** `NODE_ENV !== "production"`.
   Ngược lại → `403 { error: "demo_payment_disabled" }`.
2. Bổ sung chống replay cho chính nhánh demo (rẻ, làm luôn):
   `redis.setIfAbsent("payment:link:" + signature, "1", <ttl tới expires>)`;
   trùng → `401 { error: "payment_link_replayed" }`.
3. `validateEnv()` (TASK 1): nếu `NODE_ENV=production` **và** `PAYMENT_DEMO_MODE=true` → **throw**.
4. Ghi vào `docs/SECRETS.md` một dòng cảnh báo rõ ràng về cờ này.

**Không** viết lại luồng thanh toán thật trong task này.

---

## THỨ TỰ THỰC HIỆN

```
TASK 1 (env)        →  chặn deploy, làm trước tiên
TASK 2 (pepper)     →  phụ thuộc TASK 1
TASK 3 (show scope) →  lỗ hổng phân quyền, độc lập, có thể làm song song TASK 2
TASK 4 (rotate show key)
TASK 5 (CSRF race)
TASK 6 (audit log)
TASK 7 (quota settings)
TASK 8 (payment demo flag)
```

## SAU KHI HOÀN THÀNH

Tạo `docs/CHANGELOG-security-2026-09.md` gồm:

- Bảng: TASK | file đã đổi | có breaking không | cần biến env mới nào.
- Mục **"Cần làm khi deploy"**: danh sách biến env phải đặt trước khi lên production,
  lệnh chạy migration, và thứ tự khởi động api/web.
- Mục **"Cần theo dõi sau deploy"**: `legacy_key_hash_hits_today` (TASK 2),
  số lần fallback QR secret, tỉ lệ `403 csrf_invalid`.

## KHÔNG LÀM

- Không đổi thuật toán ký JWT (HS256 cho QR online, RS256 cho offline gate) — nằm ngoài phạm vi.
- Không đổi khoá Redis `gate:used:*` và `gate:conflict:*`.
- Không refactor cấu trúc thư mục, không đổi tên file hiện có.
- Không thêm thư viện mới.
- Không sửa migration đã tồn tại.
- Không commit file `.env`.
