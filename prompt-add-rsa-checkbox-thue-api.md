# Prompt cho Codex: Thêm checkbox "Bật chế độ ký RSA" vào form đăng ký thuê API (`/thue-api`)

## Bối cảnh

Trang `/thue-api` hiện có form đăng ký với phần "Scopes" (`Tạo QR`, `Đọc QR SVG`, `Xác minh cổng`) — đây là quyền của API key, KHÔNG liên quan đến `offlineCapable`. Hiện tại, việc bật `offlineCapable` chỉ làm được sau khi đăng ký, qua `dashboard/api-keys` (section "Che do quet offline self-service" đã có từ trước, gọi `POST /api/v1/gates/tenant-settings/enable-offline`).

Cần thêm 1 checkbox trong chính form đăng ký này để khách hàng bật ngay lúc mua gói, kèm tooltip giải thích đúng đắn — tránh phải quay lại dashboard làm thêm bước.

## Nguyên tắc đã chốt cho nội dung tooltip (quan trọng — không phải diễn đạt tùy ý)

Câu hỏi quyết định **KHÔNG PHẢI** "thiết bị của bạn có khả năng mất mạng không" — mà là **"nơi thực hiện verify có nằm ngoài phạm vi kiểm soát vật lý + vận hành liên tục của bạn hay không"**. Mất mạng chỉ là 1 hệ quả tự nhiên đi kèm khi thiết bị ở ngoài kiểm soát, không phải điều kiện định nghĩa — ví dụ 1 máy quét đặt ở sảnh công cộng, mạng luôn ổn định, vẫn cần RSA vì bất kỳ ai cũng tiếp cận vật lý được, không phải vì có nguy cơ rớt mạng.

## Việc cần làm — sửa trang `/thue-api`

### 1. Thêm state cho checkbox

Trong file chứa form đăng ký (Codex tự tìm đúng file thật của trang `/thue-api`, có thể là `apps/web/src/app/thue-api/page.tsx` hoặc tương đương theo cấu trúc thật của repo):

```tsx
const [enableOfflineRsa, setEnableOfflineRsa] = useState(false);
const [showRsaTooltip, setShowRsaTooltip] = useState(false);
```

### 2. Thêm UI checkbox + tooltip, đặt ngay dưới phần "Scopes" trong form

```tsx
<div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
  <label className="flex items-start gap-3 text-sm font-medium text-slate-700">
    <input
      type="checkbox"
      className="mt-1"
      checked={enableOfflineRsa}
      onChange={(e) => setEnableOfflineRsa(e.target.checked)}
    />
    <span className="flex-1">
      Bật chế độ ký RSA (public key rời khỏi hệ thống của bạn)
    </span>
    <button
      type="button"
      className="relative shrink-0 rounded-full text-slate-400 hover:text-slate-600"
      onMouseEnter={() => setShowRsaTooltip(true)}
      onMouseLeave={() => setShowRsaTooltip(false)}
      onClick={() => setShowRsaTooltip((v) => !v)}
      aria-label="Giai thich che do RSA"
    >
      <CircleHelp size={18} />
      {showRsaTooltip && (
        <div className="absolute right-0 top-6 z-10 w-80 rounded-xl border border-slate-200 bg-white p-4 text-left text-xs font-normal leading-relaxed text-slate-600 shadow-lg">
          Mặc định, mọi vé verify online (HMAC) — server của bạn (hoặc SmartQR)
          luôn giữ bí mật, luôn kiểm soát được. Bật mục này nếu thiết bị/app
          thực hiện verify KHÔNG nằm trong tầm kiểm soát trực tiếp của bạn —
          ví dụ máy quét đặt tại địa điểm thuê ngoài, app chạy trên điện thoại
          nhân viên, hoặc bất kỳ nơi nào có thể bị truy cập vật lý ngoài ý
          muốn. Lúc đó verify offline khi mất mạng chỉ là một lợi ích đi kèm,
          không phải lý do chính để bật — lý do chính là: nếu thiết bị đó bị
          lộ, nó cũng chỉ verify được (không tự tạo được vé giả), vì chỉ giữ
          public key.
          <br /><br />
          <strong className="text-amber-700">Không thể tắt lại sau khi đã bật.</strong>
        </div>
      )}
    </button>
  </label>
  {enableOfflineRsa && (
    <p className="mt-2 text-xs text-amber-700">
      Bạn đã chọn bật chế độ này — sau khi thanh toán xong sẽ không thể tắt lại.
    </p>
  )}
</div>
```

Import icon `CircleHelp` từ `lucide-react` (đã dùng `lucide-react` ở nhiều nơi khác trong repo, xem cách import ở các file như `gates.controller`/dashboard khác).

### 3. Xác nhận lại (confirm) trước khi submit nếu đã tick

Trong hàm submit form (tìm đúng tên hàm thật xử lý "Thanh toan va cap key"), thêm early-check:
```ts
if (enableOfflineRsa && !confirm("Ban dang bat che do ky RSA cho tenant nay. Sau khi bat, KHONG THE TAT LAI. Tiep tuc?")) {
  return;
}
```

### 4. Gửi cờ này sau khi thanh toán demo thành công

Sau bước thanh toán demo trả về `rentalId`/API key thành công (payload response đã có sẵn từ luồng `createApiRental` hiện tại), nếu `enableOfflineRsa === true`, gọi thêm:
```ts
if (enableOfflineRsa) {
  await fetch("/api/proxy-hoac-duong-goi-that/api/v1/gates/tenant-settings/enable-offline", {
    method: "POST",
    headers: { "x-api-key": rawKeyVuaNhanDuoc }
  });
}
```
**Lưu ý cho Codex**: cần dùng đúng raw key vừa cấp (chỉ hiển thị 1 lần duy nhất theo đúng cơ chế bảo mật đã ghi trong trang — "API key chỉ hiển thị một lần duy nhất ngay sau khi thanh toán thành công"), gọi ngay trong luồng xử lý response thanh toán, trước khi ẩn/xóa raw key khỏi state. Nếu route gọi API thật đi qua proxy nội bộ của `apps/web` (giống cách `route.ts` trong app demo đã làm), dùng đúng route đó thay vì gọi thẳng backend từ client.

### 5. Xử lý khi bật thất bại (endpoint enable-offline lỗi)

Vì việc tạo rental/key đã thành công trước đó (bước 4 chỉ là bước phụ thêm sau), nếu gọi `enable-offline` thất bại, **không rollback việc tạo key** — chỉ hiển thị thông báo rõ ràng cho khách:
```tsx
"Da tao API key thanh cong, nhung bat che do RSA that bai. Ban co the tu bat lai sau trong Developer Console tai dashboard/api-keys."
```

## Ràng buộc

- Không sửa lại phần "Scopes" hiện có — checkbox RSA là mục **riêng biệt**, không phải scope thứ 4
- Không đổi behavior của `dashboard/api-keys` (section bật offline ở đó vẫn giữ nguyên, dùng cho tenant nào chưa bật lúc đăng ký muốn bật sau)
- Tooltip dùng đúng nguyên văn nội dung đã chốt ở trên — không diễn đạt lại theo hướng "vì sợ mất mạng"

## Yêu cầu kiểm thử

1. Không tick checkbox → đăng ký bình thường như cũ, `offlineCapable` vẫn `false` cho tenant mới
2. Tick checkbox, xác nhận confirm dialog, thanh toán xong → gọi `GET /api/v1/gates/tenant-settings` bằng đúng key vừa cấp, xác nhận `offline_capable: true`
3. Tick checkbox nhưng bấm "Hủy" ở confirm dialog → không submit form, không tạo key
4. Giả lập `enable-offline` trả lỗi (ví dụ tắt tạm backend gate) → vẫn thấy key được cấp, kèm thông báo lỗi rõ ràng như mục 5, không mất raw key hiển thị

---

*Prompt này chỉ sửa `/thue-api` — không đụng đến `dashboard/api-keys` hay backend.*
