import Link from "next/link";
import { Download, KeyRound, Route, ShieldCheck } from "lucide-react";
import { Reveal } from "@/components/reveal";

const baseUrl = "http://localhost:4000";

const endpoints = [
  {
    group: "Auth",
    items: [
      ["POST", "/auth/register", "Đăng ký user thường.", `{"email":"new-user@smartqr.vn","password":"demo123456"}`],
      ["POST", "/auth/login", "Đăng nhập admin hoặc user, lấy access_token JWT.", `{"email":"admin@smartqr.vn","password":"admin123456"}`],
      ["GET", "/auth/me", "Kiểm tra JWT hiện tại.", "Header: Authorization: Bearer {{userToken}}"],
      ["POST", "/auth/logout", "Revoke JWT jti khỏi Redis/memory.", "Header: Authorization: Bearer {{userToken}}"]
    ]
  },
  {
    group: "Sản phẩm và linh kiện",
    items: [
      ["GET", "/products", "Lấy toàn bộ sản phẩm, thiết bị thuê và linh kiện.", ""],
      ["POST", "/products/:id/buy", "Mua linh kiện demo, trả payment_demo_url.", `{"quantity":1,"shipping_address":{"address":"12 Nguyễn Huệ, TP.HCM","phone":"0900000000"}}`]
    ]
  },
  {
    group: "Thuê API + hộp quét",
    items: [
      ["POST", "/rentals", "Tạo đơn thuê SP-01/SP-02, sau PayOS paid sẽ ACTIVE và sinh API key.", `{"product_id":"prod_sp01","type":"rent","duration":1,"quantity":1,"shipping_address":{"address":"12 Nguyễn Huệ, TP.HCM","phone":"0900000000"},"agree_damage_terms":true}`],
      ["POST", "/api-rentals", "User đăng ký thuê API cho app ngoài hệ thống, paid demo xong cấp raw API key một lần.", `{"app_name":"Gym ABC Check-in","website":"https://gym-abc.vn","plan":"starter","duration":1}`],
      ["POST", "/api/v1/qr-codes", "App ngoài tạo QR JWT và mã code bằng X-API-KEY.", `{"resource_type":"gym_member","resource_id":"member_1001","customer_ref":"Nguyen Van A","ttl_seconds":86400,"payload":{"branch":"quan-1","plan":"gold"}}`],
      ["PATCH", "/rentals/:id/return", "Đổi đơn thuê sang RETURNED.", ""]
    ]
  },
  {
    group: "White-label show",
    items: [
      ["POST", "/shows", "Tạo show, trả public_url và embed_code.", `{"name":"Đêm Nhạc Postman","banner":"https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1600&q=80","theme_color":"#18181b","location":"Nhà hát Hòa Bình, TP.HCM","start_at":"2026-10-01T20:00:00.000Z","ticket_price":100000,"total_tickets":500,"description":"Show tạo từ Postman","payout_account":{"bank":"DEMO Bank","account":"0123456789","name":"SMARTQR DEMO"}}`],
      ["GET", "/e/:slug", "Lấy thông tin show public.", ""],
      ["POST", "/e/:slug/buy", "Mua vé demo, trả payment_url và order_id.", `{"buyer_name":"Nguyễn Văn A","buyer_email":"buyer@example.com","buyer_phone":"0900000000","quantity":1}`],
      ["PATCH", "/shows/:id/end", "Kết thúc show.", ""]
    ]
  },
  {
    group: "Thanh toán và cổng quét",
    items: [
      ["POST", "/webhooks/payos-demo", "Mock PayOS paid thủ công. kind là ticket, rental hoặc api.", `{"order_id":"{{ticketOrderId}}","kind":"ticket"}`],
      ["POST", "/api/v1/tickets/verify", "Verify QR JWT hoặc ticket_code. Cần X-API-KEY hoặc X-DEMO-SCAN khi test local.", `{"ticket_code":"SQR-ABC123","gate_id":"gate-main"}`]
    ]
  },
  {
    group: "Dashboard user",
    items: [["GET", "/dashboard", "Lấy rentals, shows, apiKeys, ticketOrders, payouts, tickets demo.", ""]]
  },
  {
    group: "Admin",
    auth: "Header: Authorization: Bearer {{adminToken}}",
    items: [
      ["GET", "/admin/summary", "KPI tổng quan DB.", ""],
      ["GET", "/admin/users", "Danh sách users.", ""],
      ["GET", "/admin/products", "Danh sách sản phẩm.", ""],
      ["PATCH", "/admin/products/:id", "Sửa tên, giá, cọc, tồn kho.", `{"name":"GM65 QR Scanner","price_sell":690000,"price_rent_month":0,"deposit_fee":0,"stock":80}`],
      ["GET", "/admin/orders", "Danh sách đơn thuê/mua.", ""],
      ["GET", "/admin/shows", "Danh sách show.", ""],
      ["PATCH", "/admin/shows/:id/status", "Đổi trạng thái DRAFT/ACTIVE/ENDED.", `{"status":"ACTIVE"}`],
      ["GET", "/admin/tickets", "Danh sách ticket orders, tickets và payout.", ""],
      ["GET", "/admin/api-keys", "Danh sách API key prefix.", ""],
      ["POST", "/admin/api-keys", "Tạo API key mới. Response chỉ hiện raw key một lần.", `{"user_id":"{{userId}}","quota":10000}`]
    ]
  }
];

const flow = [
  "Import collection: /smartqr-postman-collection.json",
  "Login admin bằng admin@smartqr.vn / admin123456, copy access_token vào biến adminToken.",
  "GET /admin/users, copy id của demo@smartqr.vn vào biến userId nếu muốn tạo API key.",
  "GET /products, copy id sản phẩm vào productId. Seed có prod_sp01, prod_sp02, prod_gm65 nếu chạy in-memory; DB thật dùng id cuid nên lấy từ response.",
  "POST /rentals hoặc POST /products/:id/buy, mở payment_demo_url hoặc POST /webhooks/payos-demo.",
  "POST /shows, copy show_id vào showId và slug trong public_url vào showSlug.",
  "POST /e/:slug/buy, chờ 5 giây hoặc gọi webhook kind ticket.",
  "GET /dashboard hoặc GET /admin/tickets, copy qrJwt vào biến qrJwt.",
  "POST /api/v1/tickets/verify với X-DEMO-SCAN: true khi test local, hoặc X-API-KEY: {{apiKey}} khi dùng key thật."
];

export default function DocsPage() {
  return (
    <main className="shell py-16 md:py-24">
      <Reveal>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-zinc-500">Postman-ready</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-6xl">Tài liệu API</h1>
            <p className="mt-4 max-w-2xl text-zinc-600">Toàn bộ endpoint Phase 1 để test bằng Postman: auth, thuê hộp, tạo show, mua vé, quét QR, dashboard và admin.</p>
          </div>
          <Link href="/smartqr-postman-collection.json" className="btn btn-primary" target="_blank">
            <Download size={16} />
            Tải Postman Collection
          </Link>
        </div>
      </Reveal>

      <Reveal className="mt-10 grid gap-4 md:grid-cols-3">
        {[
          ["Base URL", baseUrl, Route],
          ["Admin", "admin@smartqr.vn / admin123456", ShieldCheck],
          ["User", "demo@smartqr.vn / demo123456", KeyRound]
        ].map(([title, value, Icon]) => (
          <article key={title as string} className="panel p-5">
            <Icon className="text-zinc-900" size={18} />
            <h2 className="mt-4 font-semibold">{title as string}</h2>
            <code className="mt-2 block break-all rounded-lg bg-zinc-50 p-3 text-xs text-zinc-700">{value as string}</code>
          </article>
        ))}
      </Reveal>

      <Reveal className="mt-10 panel p-6">
        <h2 className="text-2xl font-semibold tracking-tight">Luồng test nhanh trong Postman</h2>
        <ol className="mt-5 grid gap-3 text-sm text-zinc-600">
          {flow.map((item, index) => <li key={item}>{index + 1}. {item}</li>)}
        </ol>
      </Reveal>

      <div className="mt-10 grid gap-8">
        {endpoints.map((group) => (
          <Reveal key={group.group} className="panel overflow-hidden">
            <div className="border-b border-zinc-200 bg-zinc-50 px-5 py-4">
              <h2 className="text-xl font-semibold tracking-tight">{group.group}</h2>
              {group.auth && <p className="mt-1 text-sm text-zinc-600">{group.auth}</p>}
            </div>
            <div className="divide-y divide-zinc-200">
              {group.items.map(([method, path, desc, body]) => (
                <article key={`${method}-${path}`} className="grid gap-4 p-5 lg:grid-cols-[90px_240px_1fr]">
                  <b className={method === "GET" ? "text-emerald-700" : method === "PATCH" ? "text-amber-700" : "text-zinc-950"}>{method}</b>
                  <code className="break-all text-sm text-zinc-800">{baseUrl}{path}</code>
                  <div>
                    <p className="text-sm text-zinc-600">{desc}</p>
                    {body && (
                      <pre className="mt-3 overflow-auto rounded-lg border border-zinc-200 bg-zinc-950 p-4 text-xs leading-6 text-zinc-100">
{formatBody(body)}
                      </pre>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </Reveal>
        ))}
      </div>
    </main>
  );
}

function formatBody(value: string) {
  if (value.startsWith("Header:")) return value;
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}
