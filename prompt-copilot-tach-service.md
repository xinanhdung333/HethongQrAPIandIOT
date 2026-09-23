# Prompt cho GitHub Copilot: Tách module thành service độc lập (thay đổi tối thiểu)

## Bối cảnh

Dự án hiện tại là NestJS modular monolith, nằm trong `api/src/modules/`, gồm các module chính:
`rental`, `qr`, `ticket` (tên chính xác lấy theo cấu trúc thư mục hiện có trong `api/src/modules/`).

Tất cả module hiện chạy chung 1 process NestJS (`api/src/main.ts`), gọi nhau qua dependency injection
nội bộ (import service trực tiếp), chung 1 database.

## Mục tiêu

Tách module `ticket` (chỉ 1 module, làm thử trước) thành **1 NestJS app riêng biệt**, có thể chạy độc lập
ở port khác, giao tiếp với app chính qua REST API — **nhưng thay đổi ít nhất có thể**, không viết lại
logic nghiệp vụ, không đổi tên biến/hàm/API contract đang có.

## Yêu cầu bắt buộc — KHÔNG được làm

- KHÔNG đổi logic xử lý bên trong service/controller của module `ticket` (giữ nguyên các hàm, chỉ
  di chuyển vị trí file).
- KHÔNG đổi format response, route path, tên field trả về (`qr_jwt`, `ticket_code`, `isUsed`...).
- KHÔNG đổi database schema, không tạo migration mới trừ khi thật sự bắt buộc để tách kết nối DB.
- KHÔNG động vào các module khác (`rental`, `qr`) trong lần này — chỉ tách `ticket`.
- KHÔNG cài thêm thư viện lớn (message broker, service mesh...) — chỉ dùng `@nestjs/axios` hoặc
  `HttpModule` có sẵn của NestJS để gọi REST giữa 2 app.
- KHÔNG xóa code cũ ngay — giữ lại module `ticket` cũ trong app chính dưới dạng comment/backup
  hoặc nhánh git riêng, để có thể rollback nếu tách lỗi.

## Các bước thực hiện

### Bước 1 — Tạo app NestJS mới cho ticket-service
- Dùng Nest CLI tạo project mới: `ticket-service/` nằm ngang hàng với `api/` (không nằm trong `api/`).
- Copy nguyên vẹn các file trong `api/src/modules/ticket/` sang `ticket-service/src/modules/ticket/`,
  giữ nguyên tên file, tên class, tên hàm.
- Copy các file dùng chung mà module `ticket` phụ thuộc (`filters`, `security`, các DTO liên quan) —
  liệt kê rõ ràng những gì đã copy trong phần tóm tắt cuối cùng.

### Bước 2 — Cấu hình kết nối database
- `ticket-service` kết nối **cùng 1 database** với app chính hiện tại (không tách DB ở bước này).
- Copy nguyên cấu hình ORM/connection string hiện có (Prisma/TypeORM — theo đúng những gì `api/`
  đang dùng), chỉ đổi tên app trong file `.env.example`, không đổi giá trị connection thật.

### Bước 3 — Expose REST endpoint tương đương
- `ticket-service` chạy ở port riêng (đề xuất `3003`, nếu port này đã dùng thì chọn port trống kế tiếp,
  không trùng với app chính đang chạy port nào — kiểm tra `api/src/main.ts` trước khi chọn).
- Giữ nguyên route path hiện có, ví dụ `POST /api/v1/tickets/verify` phải hoạt động y hệt khi gọi vào
  `ticket-service` trực tiếp.

### Bước 4 — App chính gọi sang ticket-service qua HTTP
- Trong `api/src/modules/ticket/`, thay phần logic xử lý trực tiếp bằng 1 lớp gọi HTTP
  (`HttpModule`/`HttpService` của NestJS) sang `ticket-service` (dùng biến môi trường
  `TICKET_SERVICE_URL`, mặc định `http://localhost:3003`).
- Controller ở app chính vẫn giữ nguyên route cũ (`/api/v1/tickets/verify`) để **không phá vỡ hợp đồng
  API với client bên ngoài** — chỉ đổi phần bên trong từ "xử lý trực tiếp" thành "forward request sang
  ticket-service rồi trả lại kết quy y hệt".
- Nếu gọi `ticket-service` thất bại (network lỗi, service down), trả lỗi rõ ràng theo đúng format lỗi
  hiện có của dự án: `{ "error": "<code>", "message": "<human readable>" }`.

### Bước 5 — Cấu hình chạy song song (dev)
- Thêm script `dev:ticket-service` trong `package.json` gốc (hoặc `ticket-service/package.json`) để
  chạy riêng: `npm run dev:ticket-service`.
- Không sửa script `dev` hiện tại của app chính (`api/`), chỉ thêm script mới, không thay đổi hành vi
  mặc định khi ai đó chạy `npm run dev` như cũ.

### Bước 6 — (Tùy chọn, chỉ nếu có thời gian) Docker Compose
- Thêm `docker-compose.yml` ở thư mục gốc, định nghĩa 2 service: `api` (app chính) và `ticket-service`,
  cùng chung 1 network, cùng trỏ vào 1 database container hiện có (nếu đã có sẵn cấu hình DB trong
  docker hiện tại, tái sử dụng, không tạo container DB mới).

## Yêu cầu kiểm tra sau khi hoàn thành (self-check trước khi báo xong việc)

- [ ] Gọi `POST http://localhost:<port_app_chính>/api/v1/tickets/verify` vẫn trả về response **y hệt**
      như trước khi tách (so sánh field-by-field với response cũ).
- [ ] Tắt riêng `ticket-service` (Ctrl+C process đó) → app chính (`rental`, `qr`) vẫn chạy, chỉ endpoint
      `/tickets/verify` báo lỗi kết nối rõ ràng, không crash toàn bộ app chính.
- [ ] Chạy lại được `ticket-service` độc lập (`npm run dev:ticket-service`) mà không cần khởi động lại
      app chính.
- [ ] Không có file nào trong `api/src/modules/rental/` hoặc `api/src/modules/qr/` bị chỉnh sửa.
- [ ] Liệt kê rõ danh sách file đã tạo mới / đã sửa trong 1 bảng tóm tắt ở cuối, để dễ review diff.

## Ghi chú thêm cho Copilot

Đây là bước đầu tiên trong việc tách dần modular monolith thành các service độc lập theo tinh thần
kiến trúc hướng dịch vụ (SOA), phục vụ mục đích minh họa cho đồ án tốt nghiệp — ưu tiên **tính đúng đắn
và có thể demo được** (tắt/bật service độc lập, gọi REST thật giữa 2 app) hơn là tối ưu hiệu năng hay
thêm tính năng production đầy đủ (không cần load balancer, service discovery, circuit breaker ở bước này).

Nếu trong quá trình tách phát hiện module `ticket` phụ thuộc chéo quá nhiều vào code nội bộ của
`rental`/`qr` (import trực tiếp service của module khác), **dừng lại và báo cáo cụ thể chỗ phụ thuộc đó**
thay vì tự ý sửa luôn cả 2 module còn lại — để người review quyết định hướng xử lý tiếp theo.
