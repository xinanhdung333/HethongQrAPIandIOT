# Prompt cho Codex: (1) Nối RSA offline vào flow "Mở show" thật + (2) Hoàn thiện `offlineCapable` cho self-service

## Bối cảnh tổng hợp

Rà soát phát hiện 2 hệ thống vé đang tồn tại song song, không liên quan nhau trong cùng codebase:
- `Show` / `Ticket` / `TicketOrder` (qua `platform.service.ts`) — dùng cho flow **"Mở show"** thật (`createShow`, `buyTickets`, `markTicketOrderPaid`, có tính `platformFee`) — **hiện chỉ ký HS256, verify 100% online qua `dashboard/scan/scanner-client.tsx` gọi `POST /api/v1/tickets/verify`, không có bất kỳ khả năng offline nào**
- `ExternalQrCode` (qua `qr-platform.service.ts`) — dùng cho API rental self-service — đã có đủ RSA per-tenant + `offlineCapable` (việc 1-5 đã xong ở lần sửa trước)

Phần (1) dưới đây vá đúng lỗ hổng nghiêm trọng nhất: flow "Mở show" — chính là ca dùng gốc "máy quét vật lý do admin lắp, có thể mất mạng" — hiện không sống sót được khi mất mạng. Phần (2) hoàn thiện nốt 2 việc còn thiếu của `offlineCapable` bên nhánh self-service.

---

## PHẦN 1 — Nối RSA offline vào flow "Mở show" thật

### 1.1 — `platform.service.ts` → `markTicketOrderPaid()`

Hiện tại (dòng ~415-433):
```ts
const qrJwt = await this.auth.signJwt({ sub: `ticket:${order.id}:${i + 1}`, show_id: order.showId, buyer: order.buyerEmail, type: "ticket", jti }, 60 * 60 * 24 * 30);
tickets.push(await this.prisma.ticket.create({ data: { showId: order.showId, ticketOrderId: order.id, jti, qrJwt } }));
```

Sửa thành — ký thêm RS256 theo tenant = **chủ show** (`order.show.ownerId`), tái dùng đúng `signOfflineQrToken()` và `resolveTenantId` đã có sẵn từ nhánh `ExternalQrCode`:

```ts
import { signOfflineQrToken } from "../security/gate-signing";

// ... trong markTicketOrderPaid(), sau khi có order.show:
const tenantId = order.show.ownerId; // show không có rentalId/apiKey — tenant = chính chủ show
for (let i = 0; i < order.quantity; i += 1) {
  const jti = crypto.randomBytes(18).toString("hex");
  const qrJwt = await this.auth.signJwt({ sub: `ticket:${order.id}:${i + 1}`, show_id: order.showId, buyer: order.buyerEmail, type: "ticket", jti }, 60 * 60 * 24 * 30);

  const qrOfflineJwt = await signOfflineQrToken(this.prisma, {
    jti,
    resourceType: "ticket",
    resourceId: `${order.id}:${i + 1}`,
    isTest: false,
    notBefore: null
  }, tenantId);

  tickets.push(await this.prisma.ticket.create({ data: { showId: order.showId, ticketOrderId: order.id, jti, qrJwt, qrOfflineJwt } }));
}
```

**Lưu ý cho Codex**: `signOfflineQrToken()` hiện nhận tham số `qr` kiểu `ExternalQrCode` (đọc `qr.resourceType`, `qr.resourceId`, `qr.isTest`, `qr.notBefore`) — với vé show không có sẵn 1 object `ExternalQrCode` thật, cần xác nhận lại chữ ký hàm này trong `gate-signing.ts` và điều chỉnh cho nhận đúng object tối thiểu cần thiết (hoặc tách 1 object chuẩn hóa `{ jti, resourceType, resourceId, isTest, notBefore }` dùng chung cho cả 2 nhánh, tránh phải đổi field name qua lại).

### 1.2 — Migration: thêm cột `qrOfflineJwt` vào `Ticket`

```prisma
model Ticket {
  // ... field hiện có
  qrOfflineJwt String?
}
```
Cho phép `null` vì vé cũ đã phát hành trước khi vá sẽ không có — xử lý tương thích ngược giống hệt cách đã làm với `TenantGateKey` (không hồi tố, chỉ áp dụng cho vé mới).

### 1.3 — `PlatformService` cần gọi `isOfflineCapable`/set mặc định cho show

Theo đúng quyết định đã chốt ở lượt trước: **flow Managed ("mở show") luôn `offlineCapable = true`, không hỏi organizer**. Thêm vào `createShow()`:

```ts
import { enableOfflineCapable } from "../security/tenant";

async createShow(dto: ShowDto, userId: string) {
  const slug = await this.uniqueSlug(dto.name);
  const show = await this.prisma.show.create({ data: { ... } });
  await enableOfflineCapable(this.prisma, userId, userId); // tenant = ownerId, tự bật ngay, không qua endpoint self-service
  return { ... };
}
```

Và trong `markTicketOrderPaid()`, bọc phần ký RS256 ở mục 1.1 bằng check này (dù về lý thuyết luôn `true` sau bước trên, vẫn nên check tường minh để không vỡ nếu có show cũ tạo trước khi vá được deploy):
```ts
const capable = await isOfflineCapable(this.prisma, tenantId);
const qrOfflineJwt = capable ? await signOfflineQrToken(this.prisma, {...}, tenantId) : null;
```

### 1.4 — `apps/web/src/app/dashboard/scan/scanner-client.tsx` — thêm fallback offline

Đây là trang quét THẬT dùng cho show, hiện chỉ có 1 luồng gọi mạng (`api("/api/v1/tickets/verify", ...)`), không có gì chạy khi mất mạng. Cần bổ sung logic **giống hệt** `gate-offline-client.tsx` đã có (cùng cấu trúc: cache public key theo tenant vào localStorage, verify RS256 local, check `tenant_id`, TTL đồng bộ, queue log gửi khi có mạng lại):

- Copy cấu trúc cache/verify/TTL từ `gate-offline-client.tsx` sang `scanner-client.tsx` (hoặc factor thành 1 hook dùng chung `useOfflineGateVerifier(tenantId)` để không lặp code 2 nơi — khuyến khích hướng này hơn copy-paste)
- Input verify ở trang này hiện chỉ nhận `qr_jwt`/`ticket_code` — cần nhận thêm `qr_offline_jwt` (field mới trong response tạo vé ở mục 1.1) làm giá trị thực sự được vẽ vào QR khi tenant `offlineCapable = true`
- Logic chọn đường: nếu có mạng → gọi `/api/v1/tickets/verify` như cũ (chính xác nhất, có DB); nếu mất mạng → fallback verify local bằng `qr_offline_jwt` (giống hệt cơ chế `gate-offline-client.tsx`)

### 1.5 — Endpoint QR ảnh (`/svg`) cần vẽ đúng giá trị theo tenant

Hiện `getExternalQrSvg()` (nhánh `ExternalQrCode`) chỉ vẽ `qr_jwt` (online). Với vé show cần quyết định: vẽ `qr_jwt` (đơn giản, nhưng máy quét offline không đọc được trực tiếp từ ảnh — phải nhập tay `qr_offline_jwt`) hay đóng gói cả 2 giá trị vào 1 QR (JSON chứa cả `qr_jwt` và `qr_offline_jwt`, máy quét tự chọn nhánh theo tình trạng mạng). **Cần bạn (người review) chốt hướng này trước khi Codex code phần vẽ QR** — đây là quyết định UX ảnh hưởng cả cách khách hàng cầm vé lẫn cách máy quét đọc, không phải thuần kỹ thuật.

---

## PHẦN 2 — Hoàn thiện `offlineCapable` cho nhánh self-service (Việc 6-7 còn thiếu)

### 2.1 — Việc 6: KHÔNG áp dụng nữa cho nhánh `ExternalQrCode`/`createApiRental`

Xác nhận lại: nhánh `createApiRental()` (API rental self-service) **giữ nguyên `offlineCapable = false` mặc định**, KHÔNG tự động bật — đúng thiết kế ban đầu, vì đây là nhánh cho nhà hàng/phòng họp/gym tự chọn bật hay không. Việc 6 ở prompt trước chỉ áp dụng cho flow "Mở show" — đã xử lý ở Phần 1.3 bên trên rồi, không cần làm gì thêm ở `createApiRental()`.

### 2.2 — Việc 7: UI dashboard cho self-service tự bật

Thêm vào trang quản lý API key hiện có (`apps/web/src/app/dashboard/api-keys` hoặc tương đương — Codex tìm đúng trang theo cấu trúc thật của `apps/web/src/app/dashboard/`):

- 1 nút "Bật chế độ quét offline cho tenant này", gọi `POST /api/v1/gates/tenant-settings/enable-offline` (đã có sẵn từ lần trước) bằng đúng key `qr:create` của tenant đang đăng nhập
- Modal xác nhận trước khi bật, nội dung: *"Sau khi bật, không thể tắt lại. Vé phát hành sau thời điểm này sẽ có thêm `qr_offline_jwt` để máy quét xác thực không cần mạng."*
- Sau khi bật thành công, hiển thị trạng thái hiện tại ("Đã bật — kể từ {enabledAt}") thay vì nút bật, tránh gọi lại nhiều lần (dù endpoint đã idempotent, tránh gây hiểu lầm cho người dùng)

---

## Ràng buộc chung cho cả 2 phần

- Không đổi cách verify của `ExternalQrCode` (nhánh self-service) đã hoàn thiện — Phần 1 chỉ thêm code mới vào nhánh `Show`/`Ticket`, tái dùng lại các hàm đã có (`signOfflineQrToken`, `isOfflineCapable`, `enableOfflineCapable`, `resolveTenantId`-tương đương) chứ không viết lại logic ký/verify từ đầu
- Vé show cũ đã phát hành trước khi vá (không có `qrOfflineJwt`) vẫn phải verify được bình thường qua đường online — không hồi tố, không bắt buộc phải có offline token
- `scanner-client.tsx` sau khi sửa cần giữ nguyên hành vi cũ khi có mạng (verify online vẫn là đường ưu tiên, chính xác nhất vì có DB) — offline chỉ là fallback khi phát hiện mất mạng, không thay thế hoàn toàn

## Yêu cầu kiểm thử

1. Tạo show mới → xác nhận `TenantSettings` cho `ownerId` đó có `offlineCapable = true` ngay sau khi tạo, không cần gọi endpoint enable riêng
2. Mua vé cho show đó → `Ticket` record có cả `qrJwt` và `qrOfflineJwt`
3. Verify `qrOfflineJwt` bằng public key của đúng chủ show → pass; bằng public key của tenant khác (kể cả tenant self-service khác) → fail signature — test tương tự bài test cross-tenant đã viết cho `ExternalQrCode` ở lần trước, áp lại cho vé show
4. Giả lập mất mạng trên `scanner-client.tsx` (tương tự cách `gate-offline-client.tsx` đã test bằng nút "Gia lap mat mang") → verify vẫn hoạt động qua đường offline
5. Show cũ (giả lập vé tạo trước khi có cột `qrOfflineJwt`, giá trị `null`) → verify online vẫn bình thường, verify offline báo lỗi rõ ràng ("vé này không hỗ trợ offline") thay vì crash

---

*Prompt này dựa trên phát hiện: kiến trúc RSA/tenant-isolation đã xây dựng qua các lượt trước chỉ áp dụng cho nhánh `ExternalQrCode` (API rental self-service), chưa hề chạm tới flow "Mở show" thật (`Show`/`Ticket`) — vốn là ca dùng gốc cần khả năng offline nhất. Phần 1 là ưu tiên cao, nên làm trước Phần 2.*
