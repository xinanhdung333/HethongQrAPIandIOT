# SmartQR Platform

Nền tảng SmartQR giúp tạo, quản lý và xác minh QR cho vé sự kiện, thiết bị cho thuê và các hệ thống bên ngoài. Repo được tổ chức theo npm workspaces, gồm ứng dụng web, API, các dịch vụ chuyên biệt và SDK cho nhà phát triển.

## Chức năng

- Tạo show, phát hành và xác minh vé QR; hỗ trợ quét tại cổng và trạng thái show theo thời gian thực.
- Quản lý đơn thuê thiết bị, thuê API và quota sử dụng.
- Tạo QR đơn lẻ hoặc hàng loạt, kết xuất QR dạng SVG, thu hồi mã và kiểm soát quyền truy cập API.
- Developer console với API key, quota, analytics, audit log và webhook.
- Trang quản trị cho show, thiết bị, sản phẩm, đơn hàng và nội dung.
- SDK cho JavaScript/TypeScript, Python và PHP.

## Kiến trúc

```text
Trình duyệt / ứng dụng tích hợp
             │
    Web Next.js :3000
             │
      API NestJS :4000
       ├─────┼───────────┐
 Ticket :3003  Rental :3004  QR :3005
       └─────┴───────────┘
          PostgreSQL :5432
          Redis :6379
```

| Thư mục | Vai trò |
| --- | --- |
| `apps/web` | Giao diện Next.js App Router |
| `apps/api` | API chính, xác thực, thanh toán, developer console và proxy đến service |
| `apps/ticket-service` | Xác minh vé và QR tại cổng |
| `apps/rental-service` | Quản lý thuê và quota nội bộ |
| `apps/qr-service` | Tạo QR, SVG và tiêu thụ quota thuê API |
| `packages/database` | Prisma schema, migration và dữ liệu seed |
| `packages/sdk` | SDK JavaScript/TypeScript |
| `packages/sdk-python`, `packages/sdk-php` | SDK Python và PHP |

## Yêu cầu

- Node.js 20 trở lên và npm 10 trở lên.
- Docker Desktop với Docker Compose plugin (cách chạy khuyến nghị), hoặc PostgreSQL 16 và Redis 7 nếu chạy dịch vụ trên máy.

## Chạy toàn bộ bằng Docker

```bash
git clone <repo-url>
cd HeThongQRthongminh
docker compose up --build
```

Docker Compose khởi động PostgreSQL, Redis, migration, API, web và ba service chuyên biệt. Truy cập:

- Web: <http://localhost:3000>
- API: <http://localhost:4000>
- Ticket service: <http://localhost:3003>
- Rental service: <http://localhost:3004>
- QR service: <http://localhost:3005>

Dừng các container bằng `docker compose down`. Lệnh `docker compose down -v` xóa cả volume dữ liệu PostgreSQL và Redis.

## Chạy local không Docker

Khởi động PostgreSQL và Redis trước (có thể dùng Docker chỉ cho hai database):

```bash
docker compose up -d postgres redis
npm install
```

Tạo file môi trường cho API từ mẫu, rồi điều chỉnh kết nối database/cache nếu cần:

```powershell
Copy-Item apps\api\.env.example apps\api\.env
```

```bash
npm run db:setup
npm run dev
```

`db:setup` sinh Prisma Client, chạy migration ở chế độ phát triển và nạp dữ liệu mẫu. `npm run dev` chạy web và API chính. Để bật các service chuyên biệt, mở thêm terminal cho từng lệnh:

```bash
npm run dev:ticket-service
npm run dev:rental-service
npm run dev:qr-service
```

Trên Windows có thể dùng tiện ích thiết lập/chạy nhanh có sẵn:

```powershell
.\smartqr-no-docker-setup.bat
.\smartqr-dev-tool.bat
```

## Cấu hình môi trường

Các biến quan trọng được mô tả trong [`.env.example`](.env.example). API local thường cần:

| Biến | Mục đích |
| --- | --- |
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL |
| `REDIS_URL` | Chuỗi kết nối Redis |
| `JWT_SECRET`, `QR_JWT_SECRET` | Ký token phiên và QR; đặt giá trị ngẫu nhiên riêng khi triển khai |
| `API_KEY_PEPPER` | Bí mật máy chủ dùng xử lý API key |
| `API_SECRET_ENCRYPTION_KEY` | Khóa mã hóa webhook/request signing secret lưu trong DB (32 byte dạng hex) |
| `INTERNAL_SERVICE_TOKEN` | Xác thực lời gọi nội bộ giữa các service |
| `WEB_ORIGIN` | Origin của web, mặc định local là `http://localhost:3000` |
| `TICKET_SERVICE_URL`, `RENTAL_SERVICE_URL`, `QR_SERVICE_URL` | Địa chỉ các service; dùng tên service trong mạng Docker |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL` | URL API và Socket.IO mà web truy cập từ trình duyệt |
| `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM` | Thông tin PayOS khi cấu hình thanh toán thật |

Không dùng giá trị bí mật mẫu hoặc cấu hình demo trong môi trường production. Các endpoint `/internal/*` của rental service yêu cầu `x-internal-service-token` khớp với `INTERNAL_SERVICE_TOKEN`.

## API v1

Base URL local: `http://localhost:4000`. Các endpoint chính:

| Phương thức | Endpoint | Mô tả |
| --- | --- | --- |
| `POST` | `/api/v1/qr-codes` | Tạo QR |
| `POST` | `/api/v1/qr-codes/bulk` | Tạo tối đa 500 QR trong một request |
| `GET` | `/api/v1/qr-codes/:id/svg` | Lấy hình QR dạng SVG |
| `POST` | `/api/v1/qr-codes/:id/revoke` | Thu hồi QR |
| `POST` | `/api/v1/tickets/verify` | Xác minh vé hoặc mã QR; trả quyết định cho phép/từ chối |
| `GET` | `/api/v1/status` | Tình trạng API |
| `/api/v1/developer/*` | — | API key, cài đặt, analytics, audit và webhook logs |

Tạo QR cần API key có scope `qr:create`; đọc QR cần `qr:read`; xác minh vé cần `ticket:verify`. API áp dụng rate limit và quota theo key. Key thử nghiệm có tiền tố `sk_test_` không trừ quota live.

API hỗ trợ request signing HMAC tùy chọn, IP whitelist, xoay key, metadata, QR dùng nhiều lần, giới hạn gate, thời điểm hiệu lực, thu hồi và webhook. Response tạo QR duy trì các trường tương thích `qr_jwt`, `ticket_code` và `qr.*`.

## SDK

- JavaScript/TypeScript: [`packages/sdk/README.md`](packages/sdk/README.md)
- Python: [`packages/sdk-python/README.md`](packages/sdk-python/README.md)
- PHP: [`packages/sdk-php/README.md`](packages/sdk-php/README.md)

## Tài khoản dữ liệu mẫu

Sau khi chạy seed, tài khoản demo mặc định:

- Khách hàng: `demo@smartqr.vn` / `demo123456`
- Quản trị viên: `admin@smartqr.vn` / `admin123456`

Chỉ sử dụng các tài khoản này trên môi trường phát triển cục bộ.

## Lệnh thường dùng

```bash
npm run dev                 # Web và API chính
npm run build               # Build API và web
npm run lint                # Lint web
npm run db:generate         # Sinh Prisma Client
npm run db:migrate          # Migration phát triển
npm run db:migrate:deploy   # Áp dụng migration đã tạo
npm run db:seed             # Nạp dữ liệu mẫu
npm test -w @smartqr/sdk    # Test SDK JavaScript
```

Để chạy integration test API, cần PostgreSQL test riêng và `TEST_DATABASE_URL`:

```powershell
$env:TEST_DATABASE_URL = "postgresql://smartqr:1@localhost:5432/smartqr_api_test?schema=public"
npm run test:integration -w @smartqr/api
```

## Tài liệu khác

- [Hướng dẫn test bằng terminal](cach-test-bang-terminal.md)
- [Hướng dẫn test scope API](cach-test-scope-api.md)
- [Phân tích chức năng API](DOCS_PHAN_TICH_CHUC_NANG_API.md)
- [Mô hình khóa SmartQR](DOCS_MO_HINH_KHOA_SMARTQR.md)
