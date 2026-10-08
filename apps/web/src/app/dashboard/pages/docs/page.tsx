import Link from "next/link";
import { Code2, KeyRound, QrCode, ShieldCheck } from "lucide-react";
import { Reveal } from "@/components/reveal";

const baseUrl = "http://localhost:4000";

const createQrExample = String.raw`curl -X POST "${baseUrl}/api/v1/qr-codes" \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $SMARTQR_API_KEY" \
  -H "Idempotency-Key: member-1001-20261008" \
  -d '{
    "resource_type": "gym_member",
    "resource_id": "member_1001",
    "customer_ref": "customer_1001",
    "ttl_seconds": 86400,
    "max_uses": 1,
    "payload": {
      "branch": "quan-1",
      "membership": "gold"
    }
  }'`;

const verifyQrExample = String.raw`curl -X POST "${baseUrl}/api/v1/tickets/verify" \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $SMARTQR_API_KEY" \
  -d '{
    "ticket_code": "SQR-ABC123",
    "gate_id": "gate-main"
  }'`;

const createResponse = `{
  "id": "qr_record_id",
  "type": "external_qr",
  "qr_jwt": "<signed-token>",
  "ticket_code": "SQR-ABC123",
  "resource": {
    "type": "gym_member",
    "id": "member_1001",
    "customer_ref": "customer_1001"
  },
  "is_test": false,
  "max_uses": 1,
  "use_count": 0,
  "remaining_uses": 1,
  "expires_at": "2026-10-09T00:00:00.000Z",
  "status": "active"
}`;

const verifyResponse = `{
  "valid": true,
  "type": "external_qr",
  "qr_id": "qr_record_id",
  "gate_id": "gate-main",
  "resource_type": "gym_member",
  "resource_id": "member_1001",
  "customer_ref": "customer_1001"
}`;

const signingExample = String.raw`timestamp = Unix time in seconds
method = "POST"
path = "/api/v1/qr-codes"
body = exact UTF-8 JSON bytes sent in the request

X-SIGNATURE = hex(
  HMAC-SHA256(signing_secret, timestamp + method + path + body)
)

Headers:
X-TIMESTAMP: <timestamp>
X-SIGNATURE: <hex signature>`;

export default function DocsPage() {
  return (
    <main className="shell py-12 md:py-20">
      <Reveal>
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-zinc-500">SMARTQR · API RENTAL</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 md:text-5xl">Hướng dẫn sử dụng API thuê</h1>
          <p className="mt-4 text-sm leading-6 text-zinc-600 md:text-base">
            Tích hợp tạo QR cho thành viên, đơn hàng hoặc tài nguyên của ứng dụng; sau đó xác minh mã tại cổng bằng API key của gói thuê.
          </p>
        </div>
      </Reveal>

      <Reveal className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          { title: "Base URL", value: baseUrl, Icon: Code2 },
          { title: "Xác thực", value: "X-API-KEY", Icon: KeyRound },
          { title: "Scopes", value: "qr:create · ticket:verify", Icon: ShieldCheck }
        ].map(({ title, value, Icon }) => (
          <article key={title} className="panel p-5">
            <Icon size={18} className="text-zinc-900" />
            <h2 className="mt-4 font-semibold">{title}</h2>
            <code className="mt-2 block break-all rounded-lg bg-zinc-50 p-3 text-xs text-zinc-700">{value}</code>
          </article>
        ))}
      </Reveal>

      <Reveal className="mt-8 panel p-5 md:p-6">
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><KeyRound size={19} />1. Thuê API và chuẩn bị API key</h2>
        <ol className="mt-4 grid gap-3 text-sm leading-6 text-zinc-600">
          <li>1. Mở <Link className="font-medium text-zinc-950 underline underline-offset-4" href="/dashboard/pages/thue-api">Thuê API</Link>, chọn gói, thời hạn và các scope cần dùng; hoàn tất thanh toán để đơn chuyển sang ACTIVE.</li>
          <li>2. Vào <Link className="font-medium text-zinc-950 underline underline-offset-4" href="/dashboard/api-keys">Quản lý API key</Link> để tạo hoặc xem key. Raw key chỉ hiển thị một lần; lưu ở backend/vault an toàn, không nhúng vào JavaScript frontend.</li>
          <li>3. Key tạo QR cần scope <code>qr:create</code>; key xác minh cần <code>ticket:verify</code>. Có thể cấp một key chứa cả hai scope nếu gói thuê cho phép.</li>
        </ol>
        <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
          <b>Sandbox và live:</b> test key chỉ dành cho sandbox. Khi dùng test key, gửi thêm <code>X-API-Explorer: true</code>. Key live phải bỏ header này; request live có thể tiêu quota hoặc phát sinh phí. Không dùng test key để xác minh dữ liệu live.
        </div>
      </Reveal>

      <Reveal className="mt-8 panel overflow-hidden">
        <div className="border-b border-zinc-200 bg-zinc-50 p-5 md:p-6">
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><QrCode size={19} />2. Tạo mã QR</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Gửi yêu cầu server-to-server đến <code>POST /api/v1/qr-codes</code>. Thay mẫu key bằng key của môi trường đã chọn.</p>
        </div>
        <div className="grid gap-5 p-5 md:p-6 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold">cURL</h3>
            <pre className="mt-3 overflow-auto rounded-lg bg-zinc-950 p-4 text-xs leading-5 text-zinc-100"><code>{createQrExample}</code></pre>
            <h3 className="mt-5 text-sm font-semibold">Các trường chính</h3>
            <ul className="mt-2 grid gap-2 text-sm leading-5 text-zinc-600">
              <li><code>resource_type</code>, <code>resource_id</code>: loại và mã đối tượng của ứng dụng.</li>
              <li><code>customer_ref</code>, <code>payload</code>, <code>metadata</code>: thông tin bổ sung tùy chọn.</li>
              <li><code>ttl_seconds</code>: thời hạn từ 60 giây đến tối đa 365 ngày; mặc định 30 ngày.</li>
              <li><code>max_uses</code>: số lần sử dụng tối đa, mặc định 1. Có thể giới hạn bằng <code>allowed_gate_ids</code>.</li>
              <li><code>Idempotency-Key</code>: tùy chọn để retry an toàn; gửi lại cùng key và cùng body sẽ nhận kết quả cũ.</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Phản hồi tạo QR (rút gọn)</h3>
            <pre className="mt-3 overflow-auto rounded-lg bg-zinc-950 p-4 text-xs leading-5 text-zinc-100"><code>{createResponse}</code></pre>
            <p className="mt-3 text-sm leading-5 text-zinc-600">Hiển thị QR từ <code>qr_jwt</code> hoặc dùng <code>ticket_code</code> nếu cần nội dung ngắn, dễ quét. Giữ liên kết giữa mã trả về và resource của ứng dụng.</p>
          </div>
        </div>
      </Reveal>

      <Reveal className="mt-8 panel overflow-hidden">
        <div className="border-b border-zinc-200 bg-zinc-50 p-5 md:p-6">
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><ShieldCheck size={19} />3. Xác minh mã tại cổng</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Gửi <code>POST /api/v1/tickets/verify</code> với key có scope <code>ticket:verify</code>. Mã hợp lệ có thể được đánh dấu đã sử dụng.</p>
        </div>
        <div className="grid gap-5 p-5 md:p-6 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold">Xác minh bằng ticket code</h3>
            <pre className="mt-3 overflow-auto rounded-lg bg-zinc-950 p-4 text-xs leading-5 text-zinc-100"><code>{verifyQrExample}</code></pre>
            <p className="mt-3 text-sm leading-5 text-zinc-600">Hoặc thay <code>ticket_code</code> bằng <code>qr_jwt</code>. <code>gate_id</code> là mã cổng/thiết bị đang quét.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Phản hồi hợp lệ</h3>
            <pre className="mt-3 overflow-auto rounded-lg bg-zinc-950 p-4 text-xs leading-5 text-zinc-100"><code>{verifyResponse}</code></pre>
            <p className="mt-3 text-sm leading-5 text-zinc-600">Luôn kiểm tra <code>valid</code>. Khi đã hết hạn, bị thu hồi, dùng hết lượt hoặc không đúng cổng, API từ chối; không coi mọi HTTP 200 là thành công.</p>
          </div>
        </div>
      </Reveal>

      <Reveal className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="panel p-5 md:p-6">
          <h2 className="text-xl font-semibold tracking-tight">4. Ký request HMAC (nếu bật)</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Khi gói thuê bật Signing, mọi request cần timestamp và chữ ký. Tạo chữ ký ở backend của bạn bằng signing secret; không gửi secret qua request.</p>
          <pre className="mt-4 overflow-auto rounded-lg bg-zinc-950 p-4 text-xs leading-5 text-zinc-100"><code>{signingExample}</code></pre>
          <p className="mt-3 text-sm leading-5 text-zinc-600">Timestamp Unix giây phải nằm trong khoảng ±5 phút. Path và raw body dùng để ký phải khớp chính xác request gửi đi.</p>
        </section>
        <section className="panel p-5 md:p-6">
          <h2 className="text-xl font-semibold tracking-tight">Bảo mật và lỗi thường gặp</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-5 text-zinc-600">
            <li><b className="text-zinc-900">401:</b> thiếu/sai key hoặc chữ ký; kiểm tra key còn hoạt động và HMAC nếu đang bật.</li>
            <li><b className="text-zinc-900">403 forbidden_scope:</b> key không có scope phù hợp hoặc scope không nằm trong gói thuê.</li>
            <li><b className="text-zinc-900">429:</b> vượt rate limit hoặc quota; đọc <code>Retry-After</code> và các header <code>X-RateLimit-*</code>.</li>
            <li>Không đặt key thật trong mã frontend, public repository, log hoặc ảnh chụp màn hình.</li>
            <li>Test nhanh bằng <Link className="font-medium text-zinc-950 underline underline-offset-4" href="/test-api">API Playground</Link>; thao tác live vẫn có thể tiêu quota hoặc check-in thật.</li>
          </ul>
        </section>
      </Reveal>
    </main>
  );
}
