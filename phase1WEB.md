
# SPEC FINAL V3 - P1: WEB PLATFORM 3 GÓI - AI READY (PAYOS DEMO)

## Mục tiêu Final
Web chạy được ngay, 3 gói kinh doanh rõ ràng. PayOS để DEMO MOCK.

**Gói 1: API + Thiết bị** (cho gym có web sẵn)
**Gói 2: White-label Event Page** (cho show ca nhạc chỉ có Facebook - Thuê trọn bộ)
**Gói 3: Bán linh kiện + Dịch vụ**

## Sitemap & Pages
- `/` Landing: Hero, 3 gói, bảng giá, FAQ
- `/san-pham` List SP-01 Mini, SP-02 Pro. Có nút Mua / Thuê. Hiện giá bán, giá thuê, cọc.
- `/thue-thiet-bi` (Gói 1): Chọn SP, số lượng, thời gian 1/3/12 tháng, địa chỉ lắp đặt. Hiện breakdown: Tiền thuê + Cọc 2tr + Phí lắp 300k. Checkbox đồng ý điều khoản thiệt hại. POST /rentals
- `/tao-show` (Gói 2): Form: Tên show, ngày, địa điểm, banner upload, màu chủ đạo, mô tả, giá vé, số lượng vé, STK nhận tiền DEMO. Sau tạo -> public_url: /e/[slug] + embed_code iframe dán Facebook
- `/e/[slug]` Trang bán vé public white-label: Hiện banner riêng, form chọn vé, thanh toán PayOS DEMO
- `/linh-kien` E-commerce bán lẻ GM65, ESP32, Servo, Vỏ, OLED
- `/bang-gia` Bảng giá thuê, phí lắp, phí thiệt hại (Mất đền 100%, hỏng đầu quét 1tr), hoa hồng Gói 2: 5% + 199k khởi tạo
- `/docs` Tài liệu API
- `/dashboard` Sau login: overview, rentals, shows, api-keys, tickets, documents

## Tech Stack & Rules cho AI
Frontend: Next.js 14 App Router TS, Tailwind, Shadcn, Zustand, React Hook Form Zod, html5-qrcode
Backend: NestJS TS, Prisma PostgreSQL, Redis, JWT, Throttler
Bảo mật: bcrypt, API Key hash sha256, JWT jti + Redis chống replay, Zod validate, Rate limit verify 10 req/s
Cache: Redis cache GET /products 5p, GET /e/[slug] 2p
PayOS DEMO: File `payos.mock.ts` tạo fake payment link, webhook /webhooks/payos-demo tự mark paid sau 5s. Chừa env PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM

## DB Schema
users(id, email, password_hash, role)
products(id, slug, name, type: iot_mini/iot_pro/component, price_sell, price_rent_month, deposit_fee, stock, images JSON, specs JSON)
rental_orders(id, user_id, product_id, type rent/buy, duration, quantity, rent_fee, deposit_fee, install_fee, total, status pending/paid/shipped/active/returned/cancelled, shipping_address JSON, gate_ids JSON, damage_notes)
shows(id, owner_id, slug unique, name, description, banner_url, theme_color, location, start_at, ticket_price, total_tickets, sold_tickets, payout_account JSON DEMO, status)
ticket_orders(id, show_id, buyer_name, buyer_email, quantity, total_amount, platform_fee 5%, payout_amount 95%, status pending/paid, payos_payment_id mock)
tickets(id, show_id, rental_order_id, ticket_order_id, jti unique, qr_jwt, is_used bool)
api_keys(id, user_id, key_hash, prefix, quota)
payouts DEMO(id, show_owner_id, ticket_order_id, amount, status pending/transferred mock)

## API Contract
POST /rentals {product_id, type, duration, quantity, shipping_address, agree_damage_terms:true} -> {order_id, payment_demo_url}
POST /shows {name, banner, theme_color, location, start_at, ticket_price, total_tickets, payout_account} -> {show_id, public_url: /e/slug, embed_code}
GET /e/:slug Public cache 2p -> show info
POST /e/:slug/buy {buyer_name, buyer_email, quantity} -> tạo ticket_orders pending -> payos.mock.createPaymentLink -> {payment_url, order_id}
POST /webhooks/payos-demo {order_id} -> mark paid -> tạo tickets QR -> tạo payouts log -> emit socket
POST /api/v1/tickets/verify {qr_jwt, gate_id} -> check jti Redis

## Acceptance Criteria
1. Thuê SP-01: Hiện đủ phí, checkbox thiệt hại, đặt -> /thanh-toan-demo -> 5s paid -> dashboard active + API Key
2. Tạo show: Upload banner, màu, giá 100k, STK demo -> có link /e/dem-nhac-abc white-label -> mua 2 vé demo -> nhận 2 QR
3. Dashboard shows: thấy vé bán, tiền payout demo 95%
4. Quét QR bằng camera -> hợp lệ + realtime nhảy số

Build full Web Platform Phase 1 Final V3: 3 gói: Gói 1 Thuê API+Hộp (/thue-thiet-bi), Gói 2 White-label Show (/tao-show + /e/[slug]), Gói 3 Bán linh kiện (/linh-kien). Stack Next.js 14 + NestJS + Prisma PostgreSQL Redis TS. Bảo mật bcrypt, API Key hash, JWT jti + Redis, rate limit. PayOS DEMO MOCK file payos.mock.ts, w ebhook tự paid 5s, chừa env. DB schema như trên. Pages: /, /san-pham, /thue-thiet-bi, /tao-show, /e/[slug], /linh-kien, /bang-gia, /docs, /dashboard/*. Tiêu chí: Thuê được, tạo show white-label được, mua vé demo được, quét thử được, realtime.
