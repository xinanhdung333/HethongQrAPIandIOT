# PROMPT VÒNG 2 CHO GITHUB COPILOT AGENT — SmartQR: vá lại 7 lỗi phát sinh sau vòng 1

> Đây là bản vá cho code Copilot đã sinh ra ở vòng 1 (8 task bảo mật). Dán nguyên file này vào
> Copilot Chat (Agent/Edits mode). KHÔNG chạy TASK A bằng Copilot — làm tay, xem lý do bên dưới.

---

## BỐI CẢNH

Vòng 1 đã hoàn thành 7/8 task đúng yêu cầu (env validation, dual-pepper, ép showId ở gate sync,
sửa race CSRF, audit log có IP, quota-burst vào settings, chặn payment demo ở production).
Review phát hiện 7 vấn đề mới phát sinh **từ chính các thay đổi đó**. Sửa theo đúng thứ tự dưới đây.

Ràng buộc vẫn giữ nguyên như vòng 1: không phá key/vé đang lưu hành, không sửa migration cũ,
không thêm dependency, mỗi task một commit `fix(api): ...`, sau mỗi task chạy
`cd apps/api && npm run build` phải sạch.

---


---

## TASK B (P0) — Khoá `apiKeyPepperRolloverUntil` và `qrLegacyFallbackUntil` vào mốc tuyệt đối

### Vấn đề

`apps/api/src/security/auth.service.ts` hiện tính hạn rollover bằng field initializer:

```ts
private readonly qrLegacyFallbackUntil = Date.now() +
  Math.max(0, Number(process.env.QR_JWT_LEGACY_FALLBACK_DAYS ?? 30)) * 24 * 60 * 60 * 1000;
private readonly apiKeyPepperRolloverUntil = Date.now() +
  Math.max(0, Number(process.env.API_KEY_PEPPER_ROLLOVER_DAYS ?? 30)) * 24 * 60 * 60 * 1000;
```

Biểu thức này chạy lại **mỗi lần Nest khởi tạo `AuthService`** — tức mỗi lần deploy/restart process.
Hậu quả: hạn rollover không bao giờ tới thật, vì mỗi lần deploy lại cộng thêm 30 ngày kể từ lúc đó.
Cả hai cơ chế fallback (QR secret và API key pepper) đang **sống vĩnh viễn** thay vì tắt sau X ngày.

### Yêu cầu

1. Đổi 2 biến môi trường điều khiển bằng **số ngày** (`QR_JWT_LEGACY_FALLBACK_DAYS`,
   `API_KEY_PEPPER_ROLLOVER_DAYS`) sang **mốc thời gian tuyệt đối, dạng ISO date**:
   - `QR_JWT_LEGACY_FALLBACK_UNTIL` (ví dụ `"2026-10-17"`)
   - `API_KEY_PEPPER_ROLLOVER_UNTIL` (ví dụ `"2026-10-17"`)
2. Giữ biến cũ (`*_DAYS`) làm **fallback một lần duy nhất, tính từ thời điểm build** chứ không phải
   thời điểm chạy: đọc từ `process.env.BUILD_TIMESTAMP` nếu có (thêm bước ghi biến này vào
   `apps/api/Dockerfile` hoặc script build — nếu không tìm thấy file build script, tạo
   `apps/api/scripts/write-build-timestamp.mjs` chạy trong `prebuild`, ghi ra
   `apps/api/src/generated/build-timestamp.ts` export `export const BUILD_TIMESTAMP = "<ISO>"`).
   Nếu không có cả `*_UNTIL` lẫn `BUILD_TIMESTAMP`, dùng thời điểm import module lần đầu tiên
   trong tiến trình hiện tại (giữ hành vi cũ) nhưng **log một `Logger.warn` một lần duy nhất**
   cảnh báo rằng hạn sẽ bị reset mỗi lần deploy nếu không cấu hình `*_UNTIL`.
3. Parse `*_UNTIL` bằng `new Date(value)`; nếu `Number.isNaN(...)` → throw ở `validateEnv()`
   (thêm rule mới vào `apps/api/src/config/env-validation.ts`, chỉ áp dụng khi biến này **có mặt**,
   không bắt buộc phải có).
4. Cập nhật `docs/RUNBOOK-pepper-rotation.md` và tài liệu QR rollover tương ứng: bước đầu tiên khi
   bắt đầu xoay vòng phải là **đặt `*_UNTIL` thành ngày cụ thể**, không dùng biến `*_DAYS` nữa.
5. Cập nhật `.env.example`, comment rõ: "Đặt ngày cụ thể. Không dùng số-ngày-kể-từ-khi-chạy vì mỗi
   lần deploy sẽ tự gia hạn."

### Tiêu chí nghiệm thu

- Đặt `API_KEY_PEPPER_ROLLOVER_UNTIL` là ngày trong quá khứ → key băm bằng pepper cũ bị từ chối
  ngay cả khi vừa mới deploy.
- Không đặt `*_UNTIL`, có `*_DAYS` → hành vi tương thích ngược, nhưng có đúng 1 dòng warning log
  lúc khởi động (không lặp lại mỗi request).

---

## TASK C (P0) — Tách đồng hồ cho nhánh SHA-256 trần khỏi đồng hồ pepper rollover

### Vấn đề

`getApiKey()` hiện dùng chung một biến `rolloverActive` cho cả bước dò `API_KEY_PEPPER_PREVIOUS`
và bước dò SHA-256 trần (`legacyHashApiKey`):

```ts
const rolloverActive = Date.now() <= this.apiKeyPepperRolloverUntil;
const previousHash = previousPepper && rolloverActive ? this.hashApiKeyWithPepper(apiKey, previousPepper) : null;
const legacyHash = rolloverActive ? this.legacyHashApiKey(apiKey) : null;
```

Đây là hai việc khác bản chất: `API_KEY_PEPPER_PREVIOUS` là đợt xoay **đang diễn ra**, có hạn ngắn
(30 ngày là hợp lý). SHA-256 trần là **định dạng cũ từ trước khi có pepper**, không liên quan gì đến
đợt xoay pepper hiện tại — key nào chưa gọi API trong 30 ngày (khách ít dùng, job định kỳ theo mùa,
tích hợp dự phòng...) sẽ chết đột ngột mà không ai biết trước, vì hai cơ chế đang bị khoá chung.

### Yêu cầu

1. Tách biến môi trường riêng cho nhánh SHA-256 trần: `API_KEY_LEGACY_SHA256_UNTIL` (ISO date,
   tuỳ chọn — nếu không đặt thì nhánh SHA-256 trần **không có hạn**, giữ hành vi gốc trước vòng 1).
2. `getApiKey()`: `legacyHash` chỉ phụ thuộc `API_KEY_LEGACY_SHA256_UNTIL` (nếu có), độc lập với
   `apiKeyPepperRolloverUntil`.
3. Trước khi đặt hạn cho nhánh SHA-256 trần, phải có cách biết còn bao nhiêu key đang dùng nó.
   Thêm phân biệt nguồn trong counter đã có (`recordLegacyApiKeyHit`): đổi khoá Redis đếm ngày
   thành `apikey:legacy-hash:count:<source>:<YYYY-MM-DD>` với `source` là `"previous"` hoặc `"sha256"`,
   để vận hành biết rõ loại nào cần theo dõi trước khi tắt.
4. Cập nhật `docs/RUNBOOK-pepper-rotation.md`: nêu rõ đây là 2 cơ chế độc lập, chỉ đặt hạn cho
   SHA-256 trần khi counter `sha256` đã về 0 liên tục một khoảng thời gian đủ dài (gợi ý 14 ngày).

### Tiêu chí nghiệm thu

- Đặt `API_KEY_PEPPER_ROLLOVER_UNTIL` trong quá khứ nhưng không đặt `API_KEY_LEGACY_SHA256_UNTIL`
  → key sha256 cũ vẫn xác thực được, key băm bằng pepper cũ (`PREVIOUS`) bị từ chối.

---

## TASK D (P0) — Chuyển `legacy_key_hash_hits_today` khỏi endpoint công khai

### Vấn đề

`GET /api/v1/status` **không có** `@RequireApiKey()` (xác nhận: `ApiKeyGuard.canActivate` trả `true`
ngay khi decorator vắng mặt), tức là endpoint public cho mọi người xem uptime. Vòng 1 đã thêm
`legacy_key_hash_hits_today` vào đúng response này — vô tình để lộ ra ngoài tín hiệu vận hành nội bộ
(bao nhiêu key đang dùng hash cũ mỗi ngày là thông tin có giá trị trinh sát cho kẻ tấn công).

### Yêu cầu

1. Xoá `legacy_key_hash_hits_today` khỏi `StatusController` (file
   `apps/api/src/modules/status.controller.ts`) — trả `status.controller.ts` về đúng như trước
   vòng 1, chỉ giữ lại phần không liên quan (nếu có).
2. Thêm số liệu này vào `GET /api/v1/admin/summary` trong `apps/api/src/modules/admin.controller.ts`
   (endpoint này đã yêu cầu đăng nhập admin — kiểm tra lại bằng cách đọc guard/decorator đang áp
   dụng cho controller đó và tái dùng đúng cơ chế đó, không tự nghĩ ra cách xác thực mới).
   Trả về object `legacy_api_key_hashes: { previous_hits_today, sha256_hits_today }` dùng đúng
   2 khoá Redis đã tách ở TASK C.
3. Rà toàn bộ các trường đã thêm vào `status.controller.ts` ở vòng 1 (chỉ có
   `legacy_key_hash_hits_today` theo diff) — xác nhận không còn trường nội bộ nào khác lọt vào
   response public.

### Tiêu chí nghiệm thu

- `curl /api/v1/status` không có `x-api-key` vẫn trả 200, nhưng response không còn chứa
  `legacy_key_hash_hits_today`.
- `/api/v1/admin/summary` trả đúng field mới khi gọi có phiên admin hợp lệ; 401/403 khi không có.

---

## TASK E (P0) — Viết test tích hợp cho ép phạm vi `showId` ở gate sync

### Vấn đề

TASK 3 vòng 1 (chặn key quét show đọc/ghi revocation ngoài phạm vi) không có test đi kèm.
Đây là bản vá cho một lỗ hổng phân quyền thật — bắt buộc phải có test trước khi coi là xong.

### Yêu cầu

Tạo `apps/api/test/show-scope.integration.mjs`, theo đúng khuôn mẫu spawn-process của
`apps/api/test/api-platform.integration.mjs` (đọc file đó trước để tái dùng `waitForServer`,
cách seed DB test, cách tạo user/show/ticket qua Prisma trực tiếp thay vì qua API nếu không có
endpoint public tương ứng). Kịch bản cần phủ:

1. **Setup**: tạo 2 show (A, B) cùng 1 chủ sở hữu, mỗi show có ít nhất 1 vé; tạo 1 key quét
   (`showId = A.id`) và 1 key thuê API thường (`rentalId != null`) để đối chứng.
2. Thu hồi 1 vé của show A và 1 vé của show B qua `platform.service.revokeTicket` (hoặc endpoint
   revoke tương ứng nếu có sẵn). Tạo thêm 1 external QR đã thu hồi thuộc cùng chủ sở hữu.
3. `GET gates/revoked-delta` bằng key show A:
   - Có mặt jti vé show A đã thu hồi.
   - **Không có** jti vé show B.
   - **Không có** jti external QR nào (không trường `resourceType: "external_qr"` nào xuất hiện).
4. `GET gates/revoked-delta` bằng key thuê API (đối chứng): thấy **cả** ticket lẫn external_qr
   như hành vi trước khi có TASK 3 — xác nhận không phá key loại này.
5. `POST gates/usage-events` bằng key show A, body chứa 1 event
   `{ resource_type: "external_qr", jti: <bất kỳ> }` → response **403** với
   `error: "show_key_external_qr"`.
6. `POST gates/usage-events` bằng key show A, body chứa 1 event là vé của show B →
   response 200, `rejected` chứa đúng jti đó với `reason: "out_of_show_scope"`,
   `accepted_count: 0`. Sau đó truy vấn Prisma xác nhận vé show B **`isUsed` vẫn `false`**.
7. `POST gates/usage-events` bằng key show A, event là vé chính show A, chưa dùng →
   `accepted_count: 1`, vé được cập nhật `isUsed: true` trong DB.
8. Đăng ký test này vào script chạy CI/test hiện có (tìm trong `package.json` gốc hoặc
   `apps/api/package.json` xem `test:integration` glob có tự nhặt file mới theo pattern
   `test/*.integration.mjs` không — nếu có sẵn thì không cần sửa gì thêm, chỉ cần xác nhận).

### Tiêu chí nghiệm thu

`cd apps/api && npm run test:integration` chạy xanh toàn bộ, bao gồm file mới.

---

## TASK F (P1) — Thêm nút rotate cho show scanner key trên UI

### Vấn đề

Backend TASK 4 vòng 1 (rotate key quét show, grace 60 phút mặc định, `grace_minutes` tuỳ chỉnh
1–1440) đã xong, nhưng `apps/web/src/app/dashboard/shows/page.tsx` chưa có cách gọi tới —
tính năng chỉ dùng được qua gọi API trực tiếp.

### Yêu cầu

1. Trong khu vực quản lý key quét của mỗi show (tìm phần UI hiện đang hiển thị trạng thái
   `installationStatus`/`scannerCount` hoặc key hiện có của show — đọc file để xác định đúng vị trí,
   không tạo section mới trùng lặp), thêm nút "Xoay key quét".
2. Nhấn nút → mở dialog yêu cầu nhập mật khẩu (tái dùng pattern dialog nhập mật khẩu đã có ở
   `dashboard/api-keys/page.tsx` cho hành động rotate/revoke key thường — copy đúng component/hook
   nếu đã được tách riêng, không viết lại từ đầu).
3. Dialog có ô tuỳ chọn "Thời gian ân hạn (phút)", mặc định 60, giới hạn nhập 1–1440,
   optional (không nhập thì backend tự dùng mặc định).
4. Gọi `POST /api/v1/developer/keys/:id/rotate` với `grace_minutes` nếu người dùng nhập.
5. Sau khi rotate thành công, hiển thị `api_key_once` **đúng một lần** trong modal có cảnh báo
   "Lưu lại ngay, sẽ không hiện lại" (tái dùng đúng component modal `api_key_once` đã có sẵn
   cho luồng tạo key thường — kiểm tra tên component đó trong `dashboard/api-keys/page.tsx`
   trước khi viết mới).
6. Hiển thị đồng hồ đếm ngược tới thời điểm `revokeAt` của key cũ (nếu API trả về field này;
   nếu response `rotate` hiện chưa trả `revokeAt` của key cũ, bổ sung field đó vào
   `DeveloperService.rotate()` return value và cập nhật `packages/sdk/src/index.d.ts` tương ứng).

### Tiêu chí nghiệm thu

- Từ trang shows, xoay key quét thành công, thấy key mới hiện đúng một lần, thấy đếm ngược.
- Nhập `grace_minutes = 0` hoặc `1500` → validate phía client chặn trước khi gọi API.

---

## TASK G (P2) — Sửa `.env` dev thiếu `PAYMENT_DEMO_MODE` và sửa `getCsrfToken(true)`

### Vấn đề 1

`.env` dev không có `PAYMENT_DEMO_MODE`, nên `/thanh-toan-demo` trả `403 demo_payment_disabled`
ở máy dev sau vòng 1 — ai test thủ công cũng tưởng luồng thanh toán bị hỏng.

### Vấn đề 2

`apps/web/src/lib/api.ts`:

```ts
export async function getCsrfToken(force = false) {
  if (!force && csrfTokenCache) return csrfTokenCache;
  if (csrfTokenRequest) return csrfTokenRequest;   // <- bỏ qua force nếu đang có request bay
  ...
}
```

Khi gọi `getCsrfToken(true)` (nhánh retry sau `csrf_invalid`) mà đúng lúc có một request khác
đang gọi `getCsrfToken()` thường (`force = false`) chưa xong, hàm sẽ trả về promise của request
kia thay vì thực sự ép lấy token mới. Hậu quả nhẹ vì server giờ idempotent (trả lại đúng token
trong cookie), nhưng logic không khớp với tên tham số `force` và sẽ gây khó hiểu khi debug sau này.

### Yêu cầu

1. Thêm `PAYMENT_DEMO_MODE="true"` vào `.env` dev (chỉ máy dev, không phải `.env.example` —
   file đó đã đúng với `"false"`).
2. Sửa `getCsrfToken`: khi `force === true`, luôn bỏ qua `csrfTokenRequest` đang có và tạo
   một fetch mới độc lập, không dùng chung single-flight với các lệnh gọi `force=false`.
   Giữ nguyên hành vi single-flight cho các lệnh gọi `force=false` với nhau.

### Tiêu chí nghiệm thu

- Bắn đồng thời 1 request `getCsrfToken()` và 1 request `getCsrfToken(true)` → request thứ hai
  luôn tạo network call riêng, không dùng lại promise của request thứ nhất.

---

## THỨ TỰ THỰC HIỆN

```
TASK A  →  làm tay trước tiên, không giao Copilot
TASK B  →  chặn deploy tiếp theo (đồng hồ rollover)
TASK C  →  phụ thuộc TASK B
TASK D  →  độc lập, có thể làm song song B/C
TASK E  →  làm ngay sau TASK D (dùng lại 2 khoá Redis đã tách)
TASK F  →  P1, có thể lùi sau
TASK G  →  P2, làm cuối
```

## KHÔNG LÀM

- Không tự ý đổi cấu trúc `.gitignore` ngoài việc khôi phục các dòng cần thiết ở TASK A.
- Không đổi tên biến môi trường đã đúng ở vòng 1 (`API_KEY_PEPPER_PREVIOUS`,
  `QR_JWT_LEGACY_FALLBACK_DAYS` giữ làm fallback, không xoá).
- Không gộp TASK E vào file test cũ `api-platform.integration.mjs` — để riêng file mới cho dễ chạy độc lập.
- Không thêm dependency mới.
- Không sửa migration đã tồn tại từ vòng 1 (`20260917232000_...`, `20260917232100_...`).
