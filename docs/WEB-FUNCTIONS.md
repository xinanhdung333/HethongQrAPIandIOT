# Tài liệu chức năng Web SmartQR

## 1. Tổng quan

Frontend là ứng dụng Next.js trong [`apps/web`](../apps/web), chạy mặc định tại:

```text
http://localhost:3000
```

Frontend gọi API Gateway tại:

```text
http://localhost:4000
```

Các service phía sau API Gateway:

| Service | Cổng | Vai trò |
|---|---:|---|
| API Gateway | 4000 | Xác thực, session, CSRF, route public và forward request |
| Ticket service | 3003 | Xác minh ticket/QR vé |
| Rental service | 3004 | Đơn thuê API và quota |
| QR service | 3005 | Tạo, đọc, revoke và render QR API |

Frontend chỉ nên gọi API Gateway, không gọi trực tiếp các service `3003-3005`.

## 2. Điều hướng public

Header chính được khai báo tại [`header.tsx`](../apps/web/src/components/header.tsx). Các mục điều hướng:

| Route | Chức năng |
|---|---|
| `/` | Trang chủ, giới thiệu ba nhóm sản phẩm và quy trình SmartQR |
| `/san-pham` | Danh sách sản phẩm thiết bị và linh kiện |
| `/thue-thiet-bi` | Flow thuê thiết bị/SmartQR box |
| `/tao-show` | Tạo show white-label và trang bán vé riêng |
| `/linh-kien` | Danh sách linh kiện bán |
| `/bang-gia` | Bảng giá thuê, phí cọc, phí thiệt hại và hoa hồng show |
| `/thue-api` | Đăng ký gói API QR, thanh toán demo và API Explorer |
| `/docs` | Tài liệu tích hợp API cho developer |
| `/status` | Trang trạng thái hệ thống, uptime, latency và incidents |
| `/dang-nhap` | Đăng nhập tài khoản |
| `/dang-ky` | Đăng ký tài khoản customer |
| `/e/:slug` | Trang public bán vé của một show white-label |
| `/e/:slug/buy` | Form mua vé của show |

Nút `Cá nhân` mở `/dashboard`. Khi đã đăng nhập, header hiển thị thêm nút đăng xuất.

## 3. Tài khoản và xác thực

### Đăng ký

Route `/dang-ky` cho phép:

- Nhập email và mật khẩu.
- Tạo tài khoản customer.
- Đăng nhập sau khi đăng ký thành công.
- Lưu session token ở local storage phía trình duyệt.

### Đăng nhập

Route `/dang-nhap` cho phép:

- Đăng nhập bằng email/mật khẩu.
- Lưu JWT session ở `smartqr_token`.
- Chuyển về trang trước đó nếu có tham số `next`.
- Hiển thị lỗi khi sai thông tin hoặc API không kết nối.

### Đăng xuất

Header gọi API logout, xóa `smartqr_token`, rồi chuyển về trang chủ.

### CSRF

Các request thay đổi dữ liệu lấy CSRF token từ:

```text
GET /api/csrf-token
```

Frontend tự gửi header `X-CSRF-Token` và cookie trong các request POST/PATCH.

## 4. Khu vực cá nhân

Các route dashboard yêu cầu đăng nhập và được điều hướng từ `/dashboard`.

### `/dashboard`

Trang tổng quan tài khoản:

- Tóm tắt đơn thuê.
- Số lượng API key.
- Số lượng show.
- Vé đã mua.
- Link nhanh đến các màn hình quản lý.

### `/dashboard/profile`

- Xem và cập nhật thông tin hồ sơ.
- Cập nhật thông tin tài khoản.
- Quản lý avatar.

### `/dashboard/rentals`

- Xem danh sách đơn thuê.
- Xem trạng thái thanh toán và trạng thái đơn.
- Xem gói, thời hạn, quota và API key prefix.
- Theo dõi quy trình sau khi thanh toán.

### `/dashboard/api-keys`

Quản lý API key:

- Xem danh sách key và trạng thái.
- Tạo live key.
- Tạo test key.
- Xem scope `qr:create`, `qr:read`, `ticket:verify`.
- Chỉnh scope, IP whitelist và rate limit.
- Rotate key.
- Revoke key.
- Suspend/resume key.
- Xem analytics, audit và webhook logs.
- Cấu hình signing/HMAC và Gate Offline.

Raw key chỉ hiển thị một lần sau khi tạo hoặc rotate.

### `/dashboard/shows`

Quản lý show white-label:

- Tạo và xem show.
- Mở trang public `/e/:slug`.
- Theo dõi số vé và doanh thu.
- Quản lý trạng thái show.
- Kết thúc show.
- Tạo scanner key.
- Xoay scanner key.
- Xem grace period của key cũ.
- Theo dõi danh sách vé và trạng thái thanh toán.

### `/dashboard/tickets`

- Xem danh sách vé đã mua.
- Xem trạng thái thanh toán.
- Xem ticket code/QR.
- Mở flow quét thử.

### `/dashboard/scan`

Màn hình kiểm tra vé:

- Quét QR bằng camera.
- Dán ticket JWT/code thủ công.
- Chọn gate.
- Gửi request verify.
- Hiển thị `allow` hoặc `deny`.
- Hiển thị lý do từ chối, trạng thái đã dùng/hết hạn/revoked.

### `/dashboard/gate-offline`

Cấu hình và vận hành Gate Offline:

- Lấy public key.
- Kiểm tra tenant settings.
- Bật offline mode.
- Tải revoked delta.
- Gửi usage events khi gate hoạt động offline.

### `/dashboard/payments`

Theo dõi payment split:

- Danh sách giao dịch payment.
- Xem gross amount, commission và user amount.
- Xem trạng thái payout.
- Theo dõi giao dịch liên quan đến rental/QR.

### `/dashboard/settings/payout`

Quản lý thông tin nhận tiền:

- Cập nhật avatar.
- Thêm tài khoản ngân hàng.
- Thêm ví điện tử.
- Chọn tài khoản mặc định.
- Xem tài khoản payout đã lưu.
- Xóa/cập nhật tài khoản.
- Re-auth bằng mật khẩu khi thao tác nhạy cảm.

### `/dashboard/documents`

Khu vực tài liệu dành cho customer/developer, dùng để truy cập hướng dẫn và thông tin tích hợp.

## 5. Flow thuê API QR

Route chính: `/thue-api`.

Người dùng có thể:

1. Chọn gói `Starter` hoặc `Business`.
2. Chọn thời hạn thuê.
3. Chọn scope cho key:
   - `qr:create`
   - `qr:read`
   - `ticket:verify`
4. Nhập tên ứng dụng, website và callback URL.
5. Xem quota, rate limit và tổng tiền.
6. Tạo đơn thuê.
7. Thanh toán demo.
8. Nhận API key.
9. Mở API Explorer bằng test key.
10. Xem mẫu response JSON.
11. Xem ví dụ tích hợp bằng cURL, PowerShell, Python và JavaScript Fetch.
12. Tạo QR thử.
13. Verify QR/ticket thử.
14. Cấu hình Gate Offline.
15. Mở trang quản lý API key.

### Gói hiện có

| Gói | Giá mặc định | Quota | Rate limit |
|---|---:|---:|---:|
| Starter | 199.000 VND | 5.000 QR/tháng | 60 request/phút |
| Business | 499.000 VND | 30.000 QR/tháng | 600 request/phút |

Giá và giới hạn thực tế được lấy từ API platform settings.

## 6. Flow tạo và verify QR API

### Tạo QR

Client gọi API Gateway:

```text
POST /api/v1/qr-codes
```

Frontend/API Explorer hỗ trợ:

- `resource_type`
- `resource_id`
- `customer_ref`
- `payload`
- `metadata`
- `ttl_seconds`
- `max_uses`
- `allowed_gate_ids`
- `not_before`
- `Idempotency-Key`

Live key sẽ consume quota qua rental-service trước khi QR được tạo. Test key không trừ quota live.

### Bulk create

```text
POST /api/v1/qr-codes/bulk
```

Cho phép tạo nhiều QR trong một request, tối đa 500 item theo contract API.

### Đọc QR

```text
GET /api/v1/qr-codes/:id
GET /api/v1/qr-codes/:id/svg
```

### Revoke QR

```text
POST /api/v1/qr-codes/:id/revoke
```

### Verify ticket/QR

```text
POST /api/v1/tickets/verify
```

Kết quả verify trả quyết định `allow` hoặc `deny`, kèm lý do và thông tin gate/QR nếu có.

## 7. Flow thiết bị và linh kiện

### `/thue-thiet-bi`

- Giới thiệu SmartQR box và thiết bị IoT.
- Chọn gói/thiết bị.
- Nhập số lượng.
- Nhập địa chỉ giao hàng.
- Xác nhận điều khoản hư hỏng.
- Tạo đơn thuê thiết bị.
- Theo dõi thanh toán và trạng thái thuê trong dashboard.

### `/san-pham`

- Xem danh sách sản phẩm.
- Xem giá bán, giá thuê, phí cọc.
- Xem tồn kho và thông số kỹ thuật.
- Mở chi tiết sản phẩm.

### `/linh-kien`

- Xem các linh kiện GM65, ESP32, Servo, vỏ hộp, OLED.
- Xem giá bán và tình trạng tồn kho.
- Bắt đầu flow mua linh kiện.

## 8. Flow white-label show

### Tạo show

Route `/tao-show` giới thiệu:

- Trang bán vé riêng theo slug.
- Nhúng trang bán vé vào Facebook/website.
- Cấu hình nội dung và thông tin show.

### Trang public show

Route `/e/:slug` cho người mua:

- Xem thông tin show.
- Xem thời gian, nội dung và giá vé.
- Nhập thông tin người mua.
- Chọn số lượng vé.
- Thanh toán.
- Nhận ticket/QR sau khi thanh toán.

### Quản lý show

Dashboard cho chủ show:

- Theo dõi bán vé realtime.
- Xem tổng số vé, doanh thu và thanh toán.
- Mở public show.
- Quản lý scanner key.
- Kết thúc show.

## 9. Khu vực admin

Các route admin yêu cầu tài khoản có role `ADMIN`.

### `/admin`

Admin console gồm:

- Tổng quan người dùng.
- Tổng quan đơn thuê.
- Tổng quan show và vé.
- Quản lý API key.
- Quản lý sản phẩm.
- Quản lý static pages/CMS.
- Activity logs.
- Ticket management.

### `/admin/api-platform`

Quản trị API platform:

- Plan limits.
- Quota.
- Rate limit.
- Commission rate.
- Feature flags.
- Pay-as-you-go.
- API incidents/status.
- Payment transactions.
- Payout accounts.
- Webhook/security events.

## 10. Trạng thái và lỗi hiển thị

Frontend có xử lý các nhóm lỗi:

- Chưa đăng nhập: chuyển tới `/dang-nhap`.
- CSRF thiếu/sai: tự lấy token mới và retry một lần.
- API timeout: báo API phản hồi quá lâu.
- Backend mất kết nối: báo URL API cần kiểm tra.
- `401` với route public cần đăng nhập: xóa session và chuyển login.
- `403`: không đủ quyền/scope.
- `409`: xung đột idempotency hoặc quota.
- `429`: vượt rate limit.
- `503`: service phía sau không sẵn sàng.

## 11. Cấu hình chạy Web

### Development

```powershell
cd C:\HeThongQRthongminh
npm run dev -w @smartqr/web
```

Mở:

```text
http://localhost:3000
```

Frontend mặc định gọi:

```text
http://localhost:4000
```

Có thể ghi đè bằng `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

### Production build

```powershell
npm run build -w @smartqr/web
npm run start -w @smartqr/web
```

## 12. Tài khoản demo

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Customer | `demo@smartqr.vn` | `demo123456` |
| Admin | `admin@smartqr.vn` | `admin123456` |

Chỉ dùng các tài khoản này trong môi trường local/demo.

## 13. Sơ đồ chức năng tổng quát

```text
Người dùng
   │
   ├── Trang public: sản phẩm, thuê thiết bị, tạo show, thuê API
   │
   ├── Đăng nhập/đăng ký
   │
   └── Dashboard
         ├── API keys và QR
         ├── Rentals và payments
         ├── Shows và tickets
         ├── Scan verify
         ├── Gate Offline
         └── Profile/payout
                │
                ▼
          API Gateway :4000
                ├── Ticket service :3003
                ├── Rental service :3004
                └── QR service :3005
```

