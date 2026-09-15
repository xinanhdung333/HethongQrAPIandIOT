# Prompt cho Codex: Triển khai cờ `offlineCapable` theo tenant — chỉ ký RSA offline khi thật sự cần

## Bối cảnh

Hệ thống hiện tại (`apps/api`) **luôn luôn** ký thêm `qr_offline_jwt` (RS256, `signOfflineQrToken()` trong `security/gate-signing.ts`) cho mọi vé được tạo, bất kể tenant đó có bao giờ dùng máy quét offline hay không. Điều này tạo ra 2 vấn đề:
1. Sinh và lưu `TenantGateKey` (cặp khóa RSA riêng, mã hóa AES-256-GCM) cho cả những tenant không bao giờ cần — tốn tài nguyên, tăng bề mặt cần bảo vệ không cần thiết
2. Endpoint `GET /api/v1/gates/public-key` hiện lazy-create key cho bất kỳ tenant nào gọi tới, kể cả tenant chưa từng có ý định dùng offline

**Mục tiêu**: thêm cờ cấu hình theo tenant, quyết định có ký/hỗ trợ offline hay không, áp dụng cho 3 mô hình đã thống nhất:
- **Mở show** (admin lắp máy quét, admin giữ toàn bộ key tạo vé) → luôn `true`, admin set cứng lúc tạo, tenant/organizer không thấy tùy chọn này
- **Thuê API + thuê phần cứng** hoặc **self-service có bật offline** (gym, show tự tổ chức) → mặc định `false`, tenant tự bật trong dashboard, **không cho tắt lại sau khi đã bật**
- **Web self-service thường** (nhà hàng, phòng họp, verify luôn có mạng) → giữ `false`, không ký RSA, không tốn tài nguyên

## Lưu ý quan trọng trước khi code: tôi (Claude) chưa từng thấy `schema.prisma` thật của dự án qua các lần đọc code trước — mọi tên field dưới đây là đề xuất hợp lý dựa trên các model đã suy ra được từ `qr-platform.service.ts`/`gate-sync.service.ts` (`ApiKey`, `ApiRentalOrder`, `User`, `ExternalQrCode`). Codex cần đối chiếu lại đúng schema thật trước khi áp dụng, đổi tên field nếu cần cho khớp.

## Việc 1 — Thêm bảng cấu hình tenant, không gắn cứng vào `ApiRentalOrder` hay `User`

Vì `resolveTenantId(key)` trả về `rentalId ?? userId` — 2 loại ID khác bảng nhau (`ApiRentalOrder.id` hoặc `User.id`) — nên **không** thêm cột `offlineCapable` trực tiếp vào từng bảng đó (sẽ phải join 2 kiểu khác nhau tùy trường hợp). Thay vào đó tạo 1 bảng cấu hình độc lập, khóa thẳng theo giá trị mà `resolveTenantId()` trả về:

```prisma
model TenantSettings {
  tenantId       String   @id            // == resolveTenantId(key), không phải FK
  offlineCapable Boolean  @default(false)
  enabledAt      DateTime?
  enabledBy      String?                  // userId của người bật (audit)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

Chạy migration (`prisma migrate dev --name add_tenant_settings`), đảm bảo áp dụng ở mọi môi trường trước khi deploy code phụ thuộc (đúng lưu ý đã nêu ở prompt migration `TenantGateKey` trước đó — kiểm tra `npx prisma migrate status` để chắc chắn không rơi vào tình huống 500 lỗi mất dấu vết như đã từng gặp).

## Việc 2 — Helper đọc cờ, dùng chung mọi nơi

Thêm vào `apps/api/src/security/tenant.ts` (file đã có `resolveTenantId`):

```ts
export async function isOfflineCapable(prisma: PrismaClient, tenantId: string): Promise<boolean> {
  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  return settings?.offlineCapable ?? false;
}

export async function enableOfflineCapable(prisma: PrismaClient, tenantId: string, enabledBy: string) {
  await prisma.tenantSettings.upsert({
    where: { tenantId },
    update: { offlineCapable: true, enabledAt: new Date(), enabledBy },
    create: { tenantId, offlineCapable: true, enabledAt: new Date(), enabledBy }
  });
  // Không tạo hàm disableOfflineCapable() — one-way, đúng quyết định đã chốt (xem "Ràng buộc" bên dưới)
}
```

## Việc 3 — Sửa `qr-platform.service.ts` → `serializeQr()` / `createOne()`

Chỗ hiện đang gọi thẳng `signOfflineQrToken(this.prisma, qr, tenantId)` không điều kiện — sửa thành:

```ts
const tenantId = resolveTenantId({ rentalId: qr.apiKey.rentalId, userId: qr.userId });
const offlineCapable = await isOfflineCapable(this.prisma, tenantId);
const qrOfflineJwt = offlineCapable
  ? await signOfflineQrToken(this.prisma, qr, tenantId)
  : undefined;

return {
  ...,
  ...(qrOfflineJwt ? { qr_offline_jwt: qrOfflineJwt } : {}),  // omit hẳn field nếu tenant không bật, tránh hiểu nhầm là có mà không verify được
  ...
};
```

## Việc 4 — Sửa `gate-sync.service.ts` → `publicKeyForTenant()`

Từ chối rõ ràng thay vì âm thầm tạo key cho tenant chưa bật:

```ts
async publicKeyForTenant(tenantId: string) {
  const capable = await isOfflineCapable(this.prisma, tenantId);
  if (!capable) {
    throw new ForbiddenException({ error: "tenant_offline_disabled", message: "Tenant nay chua bat che do quet offline" });
  }
  const { publicKey } = await getGateKeyPairForTenant(this.prisma, tenantId);
  return { public_key: publicKey, tenant_id: tenantId, algorithm: "RS256" };
}
```

## Việc 5 — Endpoint cho tenant self-service tự bật (one-way)

Thêm vào `apps/api/src/modules/` (module dashboard/tenant-settings phù hợp với cấu trúc hiện có):

```ts
@Post("tenant-settings/enable-offline")
@RequireApiKey("qr:create")   // chỉ key có quyền tạo vé mới được bật, tránh key verify-only tự ý bật
async enableOffline(@Headers("x-api-key") raw: string) {
  const key = await this.requireKey(raw);
  const tenantId = resolveTenantId(key);
  await enableOfflineCapable(this.prisma, tenantId, key.userId);
  return { tenant_id: tenantId, offline_capable: true };
}
```

**Không viết endpoint disable** — đúng quyết định đã chốt ở phần "Ràng buộc" bên dưới.

## Việc 6 — Luồng "Mở show" (Managed): set `true` ngay lúc admin tạo rental/show nội bộ

Ở đúng chỗ backend admin tự tạo `ApiRentalOrder`/tương đương cho 1 show mới (phần này gắn với luồng thanh toán/commission đã bàn ở prompt trước — tìm trong module xử lý tạo show hoặc payment-triggered ticket issuance), gọi luôn:
```ts
await enableOfflineCapable(this.prisma, newRentalId, adminUserId);
```
ngay sau khi tạo rental — không đợi ai bật thủ công, vì mô hình Managed luôn cần offline theo đúng bài toán gốc (thiết bị vật lý do admin lắp).

## Việc 7 — UI dashboard cho self-service (nếu Codex có quyền sửa `apps/web`)

Thêm 1 nút "Bật chế độ quét offline" trong trang cấu hình API key/tenant, kèm **cảnh báo rõ ràng trước khi bật** (dùng đúng tinh thần cảnh báo one-way đã thống nhất):
> "Sau khi bật, không thể tắt lại. Vé phát hành sau thời điểm này sẽ có thêm `qr_offline_jwt` để máy quét xác thực không cần mạng."

## Ràng buộc bắt buộc

- **Không cho phép tắt lại `offlineCapable` sau khi đã bật** — lý do đã phân tích ở lượt trước: máy quét ngoài hiện trường có thể đã cache public key, tắt đột ngột gây vé mới không verify được dù trước đó vẫn hoạt động, trải nghiệm vận hành xấu và dễ bị hiểu nhầm là bug
- Vé cũ đã có `qr_offline_jwt` từ trước khi cờ này tồn tại (toàn bộ vé hiện có trong DB nếu deploy lên hệ thống đang chạy thật) **vẫn phải verify được bình thường** — không hồi tố xóa hay vô hiệu hóa các vé cũ; cờ chỉ ảnh hưởng đến vé tạo **sau** thời điểm deploy
- `gates.controller.ts` (endpoint `public-key`, `revoked-delta`) cần trả lỗi **rõ ràng, phân biệt được** giữa "tenant chưa bật offline" (`tenant_offline_disabled`) và "API key sai/thiếu quyền" (401/403 hiện có) — để `gate-offline-client.tsx` phía sau có thể hiển thị thông báo đúng thay vì chung chung "Khong tai duoc public key" như hiện tại

## Yêu cầu kiểm thử

1. Tạo vé cho tenant chưa bật `offlineCapable` → response **không có field** `qr_offline_jwt`
2. Gọi `GET /gates/public-key` cho tenant chưa bật → nhận `403 tenant_offline_disabled`, không tạo `TenantGateKey` nào trong DB (kiểm tra bằng query trực tiếp sau khi gọi)
3. Bật `offlineCapable`, tạo vé mới → có `qr_offline_jwt`, verify được bằng public key của đúng tenant
4. Gọi lại endpoint enable lần 2 (idempotent) → không lỗi, không tạo duplicate `TenantSettings`
5. Xác nhận không có endpoint/route nào cho phép set `offlineCapable = false` sau khi đã `true` (test bằng cách cố tình gọi thẳng service method nếu vô tình có, phải throw hoặc không tồn tại)

---

*Prompt này giả định trên đúng các file đã xác nhận tồn tại trong repo qua các lượt phân tích trước: `security/gate-signing.ts`, `security/tenant.ts`, `services/qr-platform.service.ts`, `services/gate-sync.service.ts`, `modules/gates.controller.ts`. Codex cần tự xác nhận `schema.prisma` thật và điều chỉnh tên field cho khớp trước khi migrate.*
