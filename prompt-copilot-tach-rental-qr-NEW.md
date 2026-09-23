# Prompt cho GitHub Copilot: Tách module `rental` và `qr` thành service độc lập

## Bối cảnh

Đã tách thành công module `ticket` thành `ticket-service` (chạy port riêng, gọi qua HTTP từ app chính,
route/response giữ nguyên). Giờ tiếp tục tách 2 module còn lại: `rental` và `qr`, theo đúng nguyên tắc
đã áp dụng cho `ticket` — **thay đổi tối thiểu, không viết lại logic, không đổi API contract**.

Khác biệt quan trọng so với lần tách `ticket`: `rental` và `qr` **có khả năng phụ thuộc lẫn nhau**
(ví dụ: khi tạo QR mới, cần kiểm tra đơn thuê API đang active, còn quota hay không — logic này hiện
đang nằm trong cùng 1 process nên gọi hàm trực tiếp được; sau khi tách sẽ phải gọi qua HTTP). Cần xử lý
kỹ phần này trước khi tách, không tự ý bỏ qua bước kiểm tra quota.

## Yêu cầu bắt buộc — KHÔNG được làm

- KHÔNG đổi logic nghiệp vụ bên trong (giữ nguyên hàm, chỉ di chuyển vị trí + đổi cách gọi giữa các
  module từ "gọi hàm nội bộ" sang "gọi HTTP").
- KHÔNG đổi response format, route path, tên field hiện có của `/api-rentals`, `/api/v1/qr-codes`,
  `/api/v1/qr-codes/:id/svg`.
- KHÔNG đổi database schema.
- KHÔNG động vào `ticket-service` đã tách ở bước trước (trừ khi `ticket-service` cần gọi sang `rental`
  hoặc `qr` — nếu có, chỉ thêm HTTP call mới, không sửa logic hiện có của `ticket-service`).
- KHÔNG cài message broker (RabbitMQ/Kafka) — chỉ dùng REST (`HttpModule`) như đã làm với `ticket-service`.

## Bước 0 — Rà soát phụ thuộc chéo trước khi tách (bắt buộc làm trước)

Trước khi viết bất kỳ code nào, liệt kê rõ:
- Module `qr` có gọi trực tiếp hàm/service nào của module `rental` không? (ví dụ: kiểm tra
  `api_rental.status === 'active'`, kiểm tra quota còn lại trước khi tạo QR)
- Module `rental` có gọi ngược lại `qr` không? (ví dụ: khi hủy đơn thuê, có cần vô hiệu hóa QR đã tạo
  không?)
- `ticket-service` (đã tách) có gọi vào `rental` hoặc `qr` không? (ví dụ: verify vé có cần biết
  `callback_url` từ đơn thuê để gửi webhook không — nếu có, đây là chỗ cần nối HTTP mới)

Viết danh sách này ra trước, báo lại cho người review xác nhận, **rồi mới bắt đầu tách code** — vì thứ tự
tách (`rental` trước hay `qr` trước) phụ thuộc vào ai gọi ai.

## Bước 0.5 — Thiết kế lại kiểm tra quota để tránh race condition (bắt buộc, làm trước khi code Bước 1)

**Vấn đề:** Hiện tại việc "kiểm tra còn quota" và "trừ quota" nằm chung 1 transaction DB (atomic) vì cùng
1 process. Nếu tách thành 2 lần gọi HTTP riêng biệt (`qr-service` hỏi "còn quota không" rồi sau đó gọi
"trừ quota"), giữa 2 lần gọi này **không còn transaction bao trùm**, dẫn tới race condition: 2 request
tạo QR gần như đồng thời có thể cùng "thấy còn quota" rồi cùng tạo QR, khiến quota bị trừ âm/vượt giới hạn.

**Cách xử lý bắt buộc:** KHÔNG tách "check quota" và "trừ quota" thành 2 API call riêng. Gộp thành
**1 endpoint atomic duy nhất** ở `rental-service`, tự xử lý check + trừ trong cùng 1 transaction DB nội
bộ của chính `rental-service` (vẫn chỉ 1 database, không phải distributed transaction):

```
POST /internal/rentals/:id/consume-quota
Body: { "amount": 1 }   // số lượng QR định tạo, mặc định 1, hỗ trợ bulk sau này

Response thành công (200):
{ "success": true, "quota_remaining": 42 }

Response hết quota (409):
{ "error": "quota_exceeded", "message": "Rental has reached its quota limit" }
```

Xử lý bên trong `rental-service` cho endpoint này phải nằm trong **1 transaction DB duy nhất**:
```
BEGIN TRANSACTION
  SELECT quota_used, quota_limit FROM rentals WHERE id = :id FOR UPDATE   -- khóa row, tránh đọc song song
  Nếu quota_used + amount > quota_limit → ROLLBACK, trả 409 quota_exceeded
  Ngược lại → UPDATE rentals SET quota_used = quota_used + amount
COMMIT
```
Dùng `SELECT ... FOR UPDATE` (row-level lock) để đảm bảo 2 request gọi endpoint này gần như đồng thời
vẫn được xử lý **tuần tự** ở tầng database, không có chuyện cả 2 cùng đọc được "còn quota" rồi cùng trừ.

**Xử lý khi tạo QR thất bại sau khi đã trừ quota (compensating transaction):**
- Nếu `qr-service` gọi `consume-quota` thành công, nhưng sau đó bước tạo QR trong DB của `qr-service`
  bị lỗi (network, validation...) → `qr-service` PHẢI gọi tiếp 1 endpoint hoàn quota:
```
POST /internal/rentals/:id/refund-quota
Body: { "amount": 1 }
```
- Endpoint này cộng lại `quota_used -= amount` (không cho âm hơn 0), cũng trong 1 transaction DB nội bộ
  của `rental-service`.
- Thứ tự bắt buộc ở `qr-service`: **trừ quota trước → tạo QR sau**. Nếu tạo QR lỗi → hoàn quota ngay.
  Không được làm ngược lại (tạo QR trước, trừ quota sau) vì sẽ tạo ra khoảng hở race condition y hệt vấn
  đề ban đầu.

**Phân biệt rõ 2 loại endpoint khi code:**
- `/internal/*` — chỉ dùng cho giao tiếp service-to-service (rental-service ↔ qr-service), KHÔNG expose
  ra ngoài internet, cần có cơ chế xác thực riêng giữa các service nội bộ (ví dụ 1 secret token dùng
  chung giữa các service, đọc từ biến môi trường `INTERNAL_SERVICE_TOKEN`, không dùng chung với API key
  của khách hàng thuê API).
- Các route cũ (`/api-rentals`, `/api/v1/qr-codes`...) vẫn giữ nguyên, dành cho client bên ngoài, không
  đổi gì về contract.

## Bước 1 — Tách `rental-service` trước (vì `qr` phụ thuộc vào `rental`, không phải ngược lại)

- Tạo app NestJS mới `rental-service/`, ngang hàng với `api/` và `ticket-service/`.
- Copy nguyên vẹn `api/src/modules/rental/` (và các file dùng chung liên quan: DTO, filters, security)
  sang `rental-service/src/modules/rental/`.
- Kết nối cùng 1 database với app chính (chưa tách DB).
- Chạy ở port riêng (đề xuất `3004`, kiểm tra không trùng port đang dùng của `api`, `ticket-service`).
- Giữ nguyên route: `POST /api-rentals`, `GET /api-rentals` hoạt động y hệt khi gọi trực tiếp vào
  `rental-service`.
- Trong app chính, đổi phần xử lý `rental` thành forward HTTP sang `rental-service`
  (biến môi trường `RENTAL_SERVICE_URL`, mặc định `http://localhost:3004`), route ở app chính giữ
  nguyên để không phá hợp đồng API với client.

## Bước 2 — Tách `qr-service`, nối gọi sang `rental-service` qua HTTP

- Tạo app NestJS mới `qr-service/`, copy `api/src/modules/qr/` sang tương tự.
- Chạy ở port riêng (đề xuất `3005`).
- Phần logic hiện đang check quota + trừ quota trực tiếp trong cùng transaction (module `rental` cũ)
  → đổi thành gọi **1 lần duy nhất** `POST /internal/rentals/:id/consume-quota` sang `rental-service`
  (theo đúng thiết kế atomic đã mô tả ở Bước 0.5), dùng biến môi trường `RENTAL_SERVICE_URL` (dùng lại
  y hệt biến đã cấu hình ở Bước 1, không tạo biến mới trùng chức năng) và header xác thực nội bộ
  `INTERNAL_SERVICE_TOKEN`.
- Thứ tự bắt buộc trong `qr-service`: gọi `consume-quota` **trước** → nếu thành công mới tạo QR trong DB
  của `qr-service` → nếu tạo QR lỗi, gọi ngay `POST /internal/rentals/:id/refund-quota` để hoàn quota.
- Nếu gọi `consume-quota` thất bại vì hết quota (409 `quota_exceeded`) → **không tạo QR**, trả lỗi đúng
  format hiện có: `{ "error": "quota_exceeded", "message": "..." }`.
- Nếu gọi `rental-service` thất bại vì lý do khác (timeout, network, service down) → **không tạo QR**,
  trả lỗi rõ ràng: `{ "error": "rental_service_unavailable", "message": "..." }`, không âm thầm bỏ qua
  bước kiểm tra quota (đây là lỗi nghiêm trọng nếu bỏ qua — tạo QR không giới hạn nếu rental-service
  down là lỗ hổng business logic).
- Giữ nguyên route `/api/v1/qr-codes`, `/api/v1/qr-codes/:id/svg` ở app chính, forward sang `qr-service`
  giống cách đã làm với `ticket-service`.

## Bước 3 — Nối `ticket-service` sang `rental-service` (nếu Bước 0 xác nhận có phụ thuộc)

- Nếu verify vé cần lấy `callback_url` từ đơn thuê để gửi webhook → thêm HTTP call từ `ticket-service`
  sang `rental-service`, dùng lại biến `RENTAL_SERVICE_URL`.
- Không sửa logic verify hiện có, chỉ thêm bước gọi lấy thông tin cần thiết trước khi xử lý webhook.

## Bước 4 — Cấu hình chạy song song (dev) & docker-compose

- Thêm script `dev:rental-service`, `dev:qr-service` (không sửa script `dev` gốc, không sửa
  `dev:ticket-service` đã có).
- Cập nhật `docker-compose.yml` (nếu đã tạo ở bước tách `ticket`) thêm 2 service mới, cùng network,
  cùng trỏ 1 database container hiện có.

## Yêu cầu kiểm tra sau khi hoàn thành (self-check)

- [ ] `POST /api-rentals`, `GET /api-rentals`, `POST /api/v1/qr-codes`, `GET /api/v1/qr-codes/:id/svg`
      qua app chính trả response **y hệt** trước khi tách (so sánh field-by-field).
- [ ] Tắt riêng `rental-service` → tạo QR mới (`qr-service`) phải **từ chối rõ ràng** (không tạo QR "chui"
      bỏ qua kiểm tra quota), báo lỗi đúng format, không crash `qr-service` hay app chính.
- [ ] Test race condition: gửi đồng thời (song song, không tuần tự) nhiều request tạo QR cho 1 rental chỉ
      còn quota = 1 (ví dụ dùng `Promise.all` hoặc công cụ load test bắn 5-10 request cùng lúc) → chỉ
      **đúng 1** request thành công, các request còn lại nhận `quota_exceeded`, quota cuối cùng trong DB
      không bị âm hoặc vượt giới hạn.
- [ ] Test refund: giả lập tạo QR thất bại sau khi đã trừ quota thành công (ví dụ tắt DB của `qr-service`
      tạm thời) → xác nhận `rental-service` nhận được lệnh `refund-quota` và quota được hoàn lại đúng.
- [ ] Endpoint `/internal/*` không gọi được nếu thiếu/sai `INTERNAL_SERVICE_TOKEN` (trả 401/403), và
      không thể gọi trực tiếp từ bên ngoài bằng API key thông thường của khách hàng.
- [ ] Tắt riêng `qr-service` → `rental-service` và `ticket-service` vẫn hoạt động bình thường ở các
      chức năng không liên quan tới QR.
- [ ] Bật/tắt độc lập từng service (`rental-service`, `qr-service`, `ticket-service`) không cần restart
      các service còn lại.
- [ ] Không có file nào ngoài phạm vi 2 module này bị chỉnh sửa ngoài dự kiến (đối chiếu lại với những gì
      đã liệt kê ở Bước 0).
- [ ] Liệt kê bảng tóm tắt: service nào gọi HTTP sang service nào, qua biến môi trường nào, để đưa vào
      sơ đồ kiến trúc trong báo cáo.

## Ghi chú thêm cho Copilot

Đây là bước tiếp theo của quá trình tách modular monolith thành các service độc lập (đã tách `ticket`
thành công ở bước trước). Ưu tiên tính **đúng đắn của business logic** (đặc biệt là kiểm tra quota giữa
`qr-service` và `rental-service`) hơn là tối ưu hiệu năng — vì đây là điểm dễ phát sinh lỗi nghiêm trọng
nhất khi tách service (network có thể fail mà logic cũ không tính tới trường hợp đó).

Nếu phát hiện có vòng lặp phụ thuộc (`rental` gọi `qr`, đồng thời `qr` gọi ngược lại `rental`) → dừng lại,
báo cáo cụ thể, không tự ý code để tránh tạo circular dependency giữa 2 service.
