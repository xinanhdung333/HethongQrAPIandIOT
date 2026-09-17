 # Mô hình khoá và vòng đời xác thực SmartQR

Tài liệu này mô tả các loại khoá đang được sử dụng trong SmartQR, trạng thái
của từng loại tài nguyên và cách hệ thống xử lý phát hành, xác thực, xoay vòng,
tạm khoá và thu hồi.

## 1. Tổng quan các loại khoá

| Loại | Mục đích | Thuật toán/cơ chế | Phạm vi |
|---|---|---|---|
| `JWT_SECRET` | Session đăng nhập của người dùng | JWT HS256 | User session, admin session |
| `QR_JWT_SECRET` | JWT trong QR ngoài và vé Show | JWT HS256 | QR/ticket token |
| API key | Xác thực ứng dụng tích hợp gọi API | HMAC-SHA256 với server pepper trong database | Một user hoặc API rental |
| Signing secret | Ký payload tích hợp theo cấu hình rental | HMAC/signing secret được mã hoá | Một API rental |
| Webhook secret | Xác thực webhook gửi tới ứng dụng khách | Secret được mã hoá | Một API rental |
| Tenant gate key | Xác thực offline gate | RSA `RS256` | Một tenant |

`JWT_SECRET` và `QR_JWT_SECRET` phải là hai giá trị độc lập trong production.
Không đưa secret thô vào database hoặc frontend.

## 2. Session JWT và QR JWT

### 2.1. Session JWT

Session login được ký bằng `JWT_SECRET`. Token có `jti`; Redis lưu trạng thái
`jwt:jti:<jti>`. Khi `jti` không còn active trong Redis, token bị từ chối.

Session JWT dùng cho:

- Đăng nhập và duy trì phiên web.
- Xác thực các endpoint developer/dashboard.
- Xác thực thao tác nhạy cảm yêu cầu password re-authentication.

### 2.2. QR/ticket JWT

QR ngoài và vé Show được ký bằng `QR_JWT_SECRET`, có các claim chính:

- `jti`: định danh duy nhất của tài nguyên.
- `type`: `external_qr` hoặc `ticket`.
- Các claim nghiệp vụ như `resource_type`, `resource_id`, `show_id`, `buyer`.

Token QR cũng được theo dõi bằng `jwt:jti:<jti>` trong Redis, nhưng trạng thái
nghiệp vụ cuối cùng vẫn do database quyết định: hết hạn, đã dùng hoặc bị
revoke đều phải bị từ chối.

### TTL chuẩn

- `external_qr`: mặc định 30 ngày, do `ttl_seconds` quyết định, giới hạn tối đa
  365 ngày.
- `ticket`: hết hạn tại `Show.endAt + 24 giờ`. Với Show cũ chưa có `endAt`,
  hệ thống dùng `startAt + 24 giờ` làm mốc tương thích.
- Redis `jwt:jti:<jti>` luôn nhận TTL bằng thời gian sống còn lại của JWT, không
  giữ JTI vô hạn.

### 2.3. Rollover secret

Khi chuyển từ cách ký QR cũ bằng `JWT_SECRET` sang `QR_JWT_SECRET`:

1. QR mới luôn được ký bằng `QR_JWT_SECRET`.
2. Verify thử `QR_JWT_SECRET` trước.
3. Nếu thất bại, hệ thống fallback sang `JWT_SECRET` trong thời gian
   `QR_JWT_LEGACY_FALLBACK_DAYS`.
4. Fallback thành công được rate-limit theo từng `jti` trong từng giờ; cùng một
JTI chỉ tạo tối đa một cảnh báo/giờ để tránh log spam.
5. Sau khi hết thời gian rollover, token cũ bị từ chối.

## 2.4. Khi mở Show: ai tạo mã và dùng khoá nào?

### Người tạo Show

Người dùng đăng nhập với vai trò customer gọi:

```http
POST /shows
Authorization: Bearer <session-jwt>
```

`ownerId` của Show chính là user đang đăng nhập. Server tạo `show.id` và
`show.slug`, sau đó trả:

- `show_id`: ID nội bộ của Show.
- `public_url`: URL công khai dạng `/e/<slug>`.
- `embed_code`: iframe để nhúng trang bán vé.

Lúc **mở/tạo Show chưa tạo vé và chưa tạo QR vé**. Việc tạo Show chỉ bật
`offline_capable` cho tenant của chủ Show.

### Khi người mua đặt vé

Người mua truy cập public URL và tạo `TicketOrder`. API này không cần API key
và không dùng khoá riêng của người mua.

Sau khi thanh toán thành công, backend server tạo từng vé:

1. Sinh `jti` ngẫu nhiên cho mỗi vé.
2. Tạo QR JWT online bằng `QR_JWT_SECRET`.
3. Lưu token vào `Ticket.qrJwt`.
4. Nếu tenant bật offline, tạo thêm token offline bằng private key RSA của
   tenant và lưu vào `Ticket.qrOfflineJwt`.

Vì vậy, **backend là bên tạo mã vé và ký mã vé**; không phải frontend, gate
hay người mua tự tạo mã.

### Các mã/khoá liên quan

| Thành phần | Ai tạo | Dùng gì |
|---|---|---|
| `show.slug` | Backend khi chủ Show mở Show | Không phải secret; dùng cho public URL |
| `Ticket.jti` | Backend sau khi thanh toán | ID chống trùng và dùng cho revoke/sync |
| `Ticket.qrJwt` | Backend sau khi thanh toán | Ký bằng `QR_JWT_SECRET`, dùng verify online |
| `Ticket.qrOfflineJwt` | Backend nếu offline được bật | Ký `RS256` bằng private key của tenant |
| Session JWT | Server khi chủ Show đăng nhập | Ký bằng `JWT_SECRET`, chỉ xác thực người tạo Show |
| API key | Developer tạo trong API platform | Dùng cho verify/revoke qua API, không dùng để tạo vé public |

Gate offline chỉ nhận **public key RSA** của tenant để verify
`qrOfflineJwt`; private key không được gửi ra gate.

### Luồng verify vé

- Verify online: server kiểm tra `qrJwt` bằng `QR_JWT_SECRET`, kiểm tra
  `RevokedResource`, `usedAt/isUsed` và ticket trong database. Vé một lần phải
  bị từ chối từ lần quét thứ hai.
- Verify offline: gate kiểm tra `qrOfflineJwt` bằng public RSA key của tenant,
  sau đó áp dụng danh sách `RevokedResource` đã đồng bộ.
- Khi vé bị revoke, server ghi `resourceType = ticket` và `jti` vào
  `RevokedResource`; gate nhận thông tin qua `revoked-delta`.

## 2.5. Bảng tình huống: chủ thể, tài nguyên và loại key

Bảng dưới đây dùng để tra nhanh trong quá trình phát triển, hỗ trợ khách hàng
và điều tra sự cố.

| Tình huống | Chủ thể thực hiện | Tài nguyên/mã được tạo | Key/token phía gọi | Key dùng phía server | Nơi lưu/trạng thái |
|---|---|---|---|---|---|
| Đăng ký tài khoản | Khách hàng | User, session ban đầu | Không có | `JWT_SECRET` | User DB, Redis JTI |
| Đăng nhập | User | Session JWT | Email/password | `JWT_SECRET` | Redis `jwt:jti:*` |
| Tạo Show | Chủ Show đã đăng nhập | `Show.id`, `Show.slug`, public URL | Session JWT | `JWT_SECRET` | Bảng `shows` |
| Kết thúc Show | Chủ Show | Đổi `Show.status` | Session JWT | `JWT_SECRET` | Bảng `shows` |
| Khách xem Show | Người mua chưa cần đăng nhập | Không tạo key | Public URL/slug | Không có | Dữ liệu Show công khai |
| Đặt vé | Người mua | `TicketOrder` | Request public | Không ký JWT tại bước này | Bảng `ticket_orders` |
| Thanh toán vé thành công | Backend | `Ticket`, `jti`, QR online | Webhook/payment callback | `QR_JWT_SECRET` | `tickets.qrJwt` |
| Tạo QR offline cho vé | Backend của tenant | `qrOfflineJwt` | Không gọi trực tiếp | Private RSA tenant key | `tickets.qrOfflineJwt` |
| Verify vé online | Gate/API client | Kết quả allow/deny, scan log | API key + `qrJwt` | `QR_JWT_SECRET` | DB ticket, Redis usage |
| Verify vé offline | Gate tại địa điểm | Kết quả allow/deny tại chỗ | `qrOfflineJwt` | Public RSA tenant key | Bộ nhớ gate |
| Revoke vé | Chủ Show hoặc API key được cấp quyền | `RevokedResource(ticket, jti)` | Session hoặc API key | Không ký lại vé | Bảng `revoked_resources` |
| Đồng bộ revoke | Gate offline | Danh sách JTI bị revoke | API key | Database tenant scope | Bộ nhớ revoke của gate |
| Tạo QR nghiệp vụ ngoài vé | Developer/API client | `ExternalQrCode`, code, JTI | API key `qr:create` | `QR_JWT_SECRET` | `external_qr_codes` |
| Đọc QR ngoài | Developer/API client | Thông tin QR đã serialize | API key `qr:read` | Không phát hành key mới | Database QR |
| Verify QR ngoài | Gate/API client | Kết quả verify, scan log | API key + QR JWT/code | `QR_JWT_SECRET` | DB, Redis usage |
| Revoke QR ngoài | Chủ resource/API client | `revokedAt` + `RevokedResource` | API key `qr:create` và `qr:read` | Không ký lại QR | QR DB + revoke DB |
| Tạo API rental | Khách hàng/developer | `ApiRentalOrder` | Session JWT | `JWT_SECRET` | Bảng `api_rental_orders` |
| Phát hành API key | Chủ rental/developer | API key thô một lần, hash lâu dài | Session JWT + password khi cần | Random bytes + HMAC-SHA256(server pepper) | `api_keys.keyHash` |
| Gọi API bằng API key | Ứng dụng tích hợp | API response/usage event | `X-API-Key` | HMAC-SHA256(server pepper), scope, quota | API logs, usage DB |
| Rotate API key | Chủ key | Key mới, key cũ deprecated | Session JWT + password | Random bytes + HMAC-SHA256(server pepper) | Key cũ `deprecated`, `revokeAt` |
| Tạm khoá API key | Chủ key/vận hành | Không tạo key mới | Session JWT | Kiểm tra `status`, `suspendUntil` | Key `suspended` |
| Revoke API key | Chủ key/vận hành | Không tạo key mới | Session JWT | Kiểm tra status/revokeAt | Key `revoked` |
| Bật signing cho rental | Chủ rental | Signing configuration/secret | Session JWT | Signing secret mã hoá | `api_rental_orders.signingSecret` |
| Rotate signing secret | Chủ rental | Secret mới trả một lần | Session JWT + password | Secret random, encrypted at rest | Secret cũ bị thay thế |
| Reveal signing/webhook secret | Chủ rental | Không tạo secret mới | Session JWT + password | Giải mã secret trong server | Audit log, không log secret |
| Gửi webhook | Backend SmartQR | Webhook event | Webhook signature | `webhookSecret` | Webhook logs/attempts |
| Tạo tenant gate key | Backend cho tenant | RSA public/private key pair | Session/API flow của tenant | RSA 2048 | `tenant_gate_keys` |
| Rotate tenant gate key | Vận hành/tenant | Key pair mới, public key cũ chuyển tiếp | Session + re-auth nếu endpoint yêu cầu | Private key mã hoá | `previousPublicKey` |
| Đọc public key gate | Gate/API client | Không tạo key mới | API key hoặc session | Server chỉ trả public key | Gate cache |

## 2.6. Phân quyền theo chủ thể

### Chủ Show

Chủ Show là user có `Show.ownerId`. Chủ thể này có thể:

- Tạo và kết thúc Show bằng session JWT.
- Xem các đơn hàng/vé thuộc Show.
- Revoke vé thuộc Show khi sử dụng endpoint/API flow được cấp quyền.
- Bật khả năng offline cho tenant của mình.

Chủ Show **không được biết** `QR_JWT_SECRET`, private RSA key tenant hoặc
secret nội bộ của server.

### Người mua vé

Người mua chỉ tạo `TicketOrder` và nhận vé sau khi thanh toán thành công.
Người mua không được:

- Tự ký lại `qrJwt`.
- Tạo hoặc đọc private key.
- Revoke vé của người khác.
- Truy cập API key của tenant.

### Developer/API client

Developer sở hữu API rental và API key. Quyền thực tế phụ thuộc scopes:

- `qr:create`: tạo/revoke QR và các thao tác được gắn scope này.
- `qr:read`: đọc QR, lấy SVG/thông tin QR.
- `ticket:verify`: verify ticket/QR và đồng bộ gate.

API key test chỉ được dùng trong sandbox; không được truy cập dữ liệu live nếu
luồng kiểm tra isolation phát hiện khác môi trường.

### Gate offline

Gate chỉ nên có:

- Public RSA key của tenant.
- QR/ticket token do server cấp.
- Danh sách JTI đã revoke.
- Bộ đếm usage/conflict cục bộ.

Gate demo lưu `lastSeenJti`/bản đồ JTI đã dùng cục bộ và chặn lần quét lại
ngay cả khi chưa kịp đồng bộ server. Khi kiểm tra `exp`/`nbf`, gate cho phép
clock skew tối đa 5 phút (`clockTolerance = 300s`).

Gate không được có `JWT_SECRET`, `QR_JWT_SECRET`, API key thô dài hạn hoặc
private RSA key.

API key mới có dạng `sq_live_<random>` hoặc `sq_test_<random>`. Database lưu
HMAC-SHA256 với `API_KEY_PEPPER`, không lưu SHA-256 trần. Các key cũ dạng
`sk_*` được verify một lần bằng hash legacy rồi tự nâng cấp sang HMAC khi được
sử dụng thành công.

### Backend SmartQR

Backend là nơi duy nhất có quyền:

- Ký session JWT và QR JWT.
- Ký QR offline bằng private RSA tenant key.
- Tạo JTI.
- Ghi revoke vào database.
- Kiểm tra quota, scope, rental status và trạng thái key.

## 2.7. Sơ đồ chọn key theo loại request

```text
User login / dashboard
  -> session JWT
  -> verify bằng JWT_SECRET

Chủ Show tạo Show
  -> session JWT
  -> verify bằng JWT_SECRET
  -> tạo Show.id + Show.slug

Backend phát hành vé sau thanh toán
  -> tạo Ticket.jti
  -> ký qrJwt bằng QR_JWT_SECRET
  -> nếu offline: ký qrOfflineJwt bằng private RSA tenant key

Verify online
  -> API key xác định client/tenant
  -> QR/ticket JWT verify bằng QR_JWT_SECRET
  -> kiểm tra DB + RevokedResource

Verify offline
  -> gate verify qrOfflineJwt bằng public RSA tenant key
  -> kiểm tra expiry/not-before
  -> kiểm tra local revoked JTI

Quản trị API key/secret
  -> session JWT + password re-auth
  -> audit ActivityLog
```

## 2.8. Bảng lỗi thường gặp theo loại key

| Hiện tượng | Khả năng nguyên nhân | Cần kiểm tra |
|---|---|---|
| Đăng nhập thất bại | Session JWT sai/hết hạn hoặc JTI không còn active | `JWT_SECRET`, Redis `jwt:jti:*` |
| QR online mới bị invalid | API instance dùng sai QR secret | `QR_JWT_SECRET` trên toàn bộ instance |
| QR cũ invalid trong rollover | Đã hết fallback window | `QR_JWT_LEGACY_FALLBACK_DAYS`, log fallback |
| Gate offline không verify được | Public key không đúng tenant hoặc key đã rotate | `tenantId`, `publicKey`, `previousPublicKey` |
| Vé online còn hạn nhưng bị từ chối | Vé đã revoke/đã dùng/DB không thuộc tenant | `Ticket`, `RevokedResource`, scan log |
| API key bị từ chối | Key suspended/revoked, rental inactive hoặc thiếu scope | `status`, `suspendUntil`, `revokeAt`, scopes |
| API key bị quota exceeded | Đã vượt quota tháng hoặc burst cảnh báo | `ApiUsagePeriod`, `ApiUsageEvent` |
| Gate vẫn cho vé đã revoke | Chưa gọi `revoked-delta` hoặc lưu sai `since` | `revokedAt`, `server_time`, local revoke cache |

Biến môi trường:

```env
JWT_SECRET="secret-cho-session"
QR_JWT_SECRET="secret-rieng-cho-qr"
QR_JWT_LEGACY_FALLBACK_DAYS="30"
```

Khuyến nghị triển khai:

- Đặt thời gian fallback dài hơn TTL tối đa của QR/ticket cũ.
- Theo dõi log fallback trước khi tắt tương thích.
- Sau rollover, đổi `QR_JWT_SECRET` theo quy trình rotate secret riêng.

## 3. API key

API key thô chỉ được trả về một lần khi phát hành. Database chỉ lưu:

- `keyHash`: HMAC-SHA256 của key với `API_KEY_PEPPER`.
- `prefix`: tiền tố để hiển thị và tra cứu vận hành.
- `scopes`: quyền như `qr:create`, `qr:read`, `ticket:verify`.
- `quota`, `rateLimit`, `allowedIps`.
- `rentalId`, `isTest`.

API key hợp lệ phải vượt qua tất cả điều kiện:

1. Hash tồn tại.
2. Key không bị revoke.
3. Key không đang bị suspend.
4. API rental liên kết phải ở trạng thái `ACTIVE`.
5. Scope và IP phải cho phép request.

## 4. Trạng thái và vòng đời API key

### `active`

Trạng thái hoạt động bình thường. Key được phép gọi API nếu rental và scope
hợp lệ.

### `deprecated`

Trạng thái chuyển tiếp sau khi rotate key. Key cũ vẫn hoạt động cho đến
`revokeAt`, mặc định là 7 ngày sau khi rotate. Hệ thống maintenance có thể
gửi cảnh báo trước thời điểm thu hồi.

### `suspended`

Khoá tạm thời, dùng cho điều tra sự cố hoặc tranh chấp thanh toán mà không cần
phát hành key mới.

- Trường trạng thái: `status = "suspended"`.
- Thời điểm kết thúc: `suspendUntil`.
- Endpoint: `POST /api/v1/developer/keys/:id/suspend`.
- Có thể truyền `until` là ISO datetime tương lai.
- Nếu không truyền, mặc định tạm khoá 24 giờ.

Sau khi `suspendUntil` đã qua, key không còn bị chặn bởi điều kiện suspend.
Nên thực hiện thao tác resume/chuẩn hoá trạng thái thành `active` trong giao
diện vận hành khi cần hiển thị trạng thái chính xác.

### `revoked`

Thu hồi vĩnh viễn. Key bị từ chối ngay lập tức và không nên được tái kích hoạt.

- Endpoint: `POST /api/v1/developer/keys/:id/revoke`.
- `revokeAt` được ghi nhận để phục vụ điều tra.

### Luồng rotate API key

1. Xác minh lại password người dùng.
2. Key cũ chuyển sang `deprecated`.
3. Gán `revokeAt` sau 7 ngày.
4. Phát hành key mới với scope/quota tương ứng.
5. Trả `api_key_once` đúng một lần.
6. Ghi audit action `ROTATE_API_KEY`.

## 5. Revocation tài nguyên QR và vé

### 5.1. Bảng `RevokedResource`

Tất cả tài nguyên cần đồng bộ revoke offline dùng chung bảng:

| Trường | Ý nghĩa |
|---|---|
| `resourceType` | Loại tài nguyên, hiện có `external_qr` và `ticket` |
| `jti` | JTI của QR hoặc vé |
| `revokedAt` | Thời điểm thu hồi |
| `tenantId` | Tenant sở hữu tài nguyên |
| `isTest` | Phân biệt sandbox/live |
| `userId` | User sở hữu, nếu có |

Ràng buộc duy nhất là cặp `resourceType + jti`, tránh ghi trùng một lần revoke.
Thiết kế này cho phép thêm loại tài nguyên mới như voucher hoặc membership card
mà không cần tạo thêm endpoint delta riêng.

### 5.2. Revoke QR ngoài

Endpoint:

```http
POST /api/v1/qr-codes/:id/revoke
```

Hệ thống cập nhật `ExternalQrCode.revokedAt` và upsert bản ghi tương ứng trong
`RevokedResource`.

### 5.3. Revoke vé Show

Endpoint:

```http
POST /api/v1/tickets/:id/revoke
```

Vé được xác định theo owner của Show và tạo bản ghi:

```text
resourceType = ticket
jti = ticket.jti
tenantId = show.ownerId
```

### 5.4. Đồng bộ gate offline

Gate gọi:

```http
GET /api/v1/gates/revoked-delta?since=<ISO_DATETIME>
```

Response có dạng:

```json
{
  "revoked": [
    {
      "resource_type": "ticket",
      "jti": "ticket-jti",
      "revoked_at": "2026-09-15T12:00:00.000Z"
    }
  ],
  "server_time": "2026-09-15T12:01:00.000Z"
}
```

Gate chỉ cần một lần sync để nhận cả revoke QR và revoke vé. Client offline nên
lưu `server_time` của response làm giá trị `since` cho lần kế tiếp.

## 6. Tenant gate key

Tenant gate key dùng cho QR offline, độc lập với JWT session và API key. Trong
phiên bản hiện tại, `tenantId` đang là owner scope: với Show là `show.ownerId`,
với API rental là `rentalId`. Đây là tenant logic hiện tại, chưa phải mô hình
organization nhiều user. Nếu mở rộng organization, cần tạo bảng `tenants` và
đổi quan hệ owner/member trước khi dùng chung key giữa nhiều user.

- Thuật toán: `RS256`.
- Private key được mã hoá trong `privateKeyEnc`.
- Public key trả cho gate qua endpoint public-key.
- Có `previousPublicKey` để hỗ trợ chuyển tiếp khi rotate.
- Chỉ tenant đã bật offline mới được nhận public key.

Endpoint liên quan:

```http
GET /api/v1/gates/public-key
GET /api/v1/gates/session-public-key
POST /api/v1/gates/tenant-settings/enable-offline
```

Khi rotate gate key, gate phải giữ public key cũ trong thời gian chuyển tiếp,
đồng thời server phải ghi audit cho thao tác rotate/reveal key.

## 7. Signing secret và webhook secret

Mỗi API rental có thể có:

- `signingSecret`: dùng khi ứng dụng khách bật signing.
- `webhookSecret`: dùng để xác thực webhook.

Secret được lưu dưới dạng mã hoá. Endpoint rotate yêu cầu password:

```http
POST /api/v1/developer/rentals/:id/secrets
POST /api/v1/developer/rentals/:id/secrets/reveal
```

Secret mới chỉ trả về một lần khi rotate. Việc reveal không tạo secret mới,
nhưng phải được audit với action `REVEAL_RENTAL_SECRETS`.

## 8. Audit và cảnh báo vận hành

Các thao tác nhạy cảm cần audit:

- `ROTATE_API_KEY`
- `REVOKE_API_KEY`
- `SUSPEND_API_KEY`
- `ROTATE_RENTAL_SECRET`
- `REVEAL_RENTAL_SECRETS`
- Rotate tenant gate key
- Revoke QR hoặc ticket

Audit nên bao gồm user, target type/id, method, path, IP, user-agent và
metadata liên quan. Không ghi API key thô hoặc secret vào log.

Hệ thống có hai nhóm cảnh báo quota:

1. Cảnh báo theo quota tháng.
2. Cảnh báo burst bất thường trong một cửa sổ ngắn.

Biến môi trường burst:

```env
API_QUOTA_BURST_WINDOW_MINUTES="15"
API_QUOTA_BURST_PERCENT="10"
```

Ví dụ: nếu một rental sử dụng từ 10% quota tháng trong 15 phút, hệ thống tạo
notification `quota_burst_warning`. Đây là tín hiệu điều tra, không tự động
revoke key.

## 9. Quy trình xử lý sự cố khuyến nghị

### Nghi ngờ API key bị lộ

1. `suspend` key ngay để chặn tạm thời.
2. Kiểm tra audit log, API request log và quota burst notification.
3. Nếu xác nhận lộ key, `revoke` vĩnh viễn.
4. Rotate và phân phối key mới qua kênh an toàn.

### Nghi ngờ QR/ticket bị sao chép

1. Revoke đúng tài nguyên theo `id`.
2. Kiểm tra `RevokedResource` đã có bản ghi.
3. Yêu cầu gate gọi `revoked-delta`.
4. Kiểm tra các scan log và conflict offline.

### Rollover QR secret

1. Đặt `QR_JWT_SECRET` mới trên toàn bộ API instance.
2. Giữ `JWT_SECRET` cũ ổn định trong thời gian fallback.
3. Theo dõi cảnh báo legacy fallback.
4. Chờ hết TTL token cũ và thời gian fallback.
5. Tắt fallback bằng cách đặt thời gian về `0` hoặc loại bỏ secret cũ theo
   quy trình phát hành.

## 10. Checklist production

- [ ] `JWT_SECRET` và `QR_JWT_SECRET` là hai secret ngẫu nhiên khác nhau.
- [ ] `API_KEY_PEPPER` là secret ngẫu nhiên riêng, không dùng lại JWT secret.
- [ ] Không dùng giá trị `dev-secret` hoặc secret trong file mẫu.
- [ ] Đã chạy migration `20260915210000_add_revoked_resources`.
- [ ] Đã kiểm tra gate nhận được cả `external_qr` và `ticket` trong delta.
- [ ] Đã thử rotate, suspend và revoke API key.
- [ ] Đã kiểm tra audit không chứa secret thô.
- [ ] Đã cấu hình quota burst notification.
- [ ] Đã có kế hoạch hết hạn legacy QR fallback.
