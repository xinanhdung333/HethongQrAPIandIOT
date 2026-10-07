import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  CircleOff,
  Code2,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  QrCode,
  Radio,
  RotateCw,
  Server,
  ShieldCheck,
  Ticket,
  Wifi,
  WifiOff
} from "lucide-react";
import { Reveal } from "@/components/reveal";

const ports = [
  {
    name: "Ticket Service",
    port: "3003",
    impact: "Tắt sẽ làm hỏng xác minh vé online qua API.",
    command: "docker compose stop ticket-service"
  },
  {
    name: "Rental Service",
    port: "3004",
    impact: "Tắt sẽ ảnh hưởng quản lý thuê API và consume/refund quota.",
    command: "docker compose stop rental-service"
  },
  {
    name: "QR Service",
    port: "3005",
    impact: "Tắt sẽ ảnh hưởng tạo, đọc, thu hồi và lấy SVG QR thuê API.",
    command: "docker compose stop qr-service"
  }
];

export default function QrVePage() {
  return (
    <main className="shell !w-[calc(100%-32px)] !max-w-[1200px] min-w-0 py-8 md:py-10">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-zinc-500">SmartQR · Hướng dẫn hệ thống</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">
              QR, vé và các cổng dịch vụ
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Tìm hiểu mã nào được tạo, khóa nào ký và xác minh, luồng API thuê,
              cùng ảnh hưởng khi dừng từng service.
            </p>
          </div>
          <a href="#luong-tao-ve" className="btn btn-primary text-sm">
            Xem luồng tạo vé <ArrowDown size={15} />
          </a>
        </div>
      </Reveal>

      <Reveal className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={<Ticket size={17} />} title="Vé Show" value="Tạo sau khi thanh toán" />
        <SummaryCard icon={<LockKeyhole size={17} />} title="QR online" value="JWT · HS256" />
        <SummaryCard icon={<KeyRound size={17} />} title="QR offline" value="JWT · RSA RS256" />
        <SummaryCard icon={<Code2 size={17} />} title="API thuê" value="API key + scopes" />
      </Reveal>

      <Reveal className="mt-8">
        <section className="panel overflow-hidden">
          <SectionHeading
            icon={<Fingerprint size={18} />}
            eyebrow="Đừng nhầm các giá trị"
            title="Mỗi mã có một vai trò riêng"
            description="QR là hình ảnh để máy quét đọc; bên trong là token hoặc mã tra cứu. API key chỉ cấp quyền gọi API."
          />
          <div className="grid divide-y divide-zinc-200 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">
            <MeaningCard icon={<QrCode size={16} />} title="QR JWT" detail="Payload vé/QR được ký. Online dùng QR_JWT_SECRET; offline có thể dùng RSA." />
            <MeaningCard icon={<Fingerprint size={16} />} title="jti" detail="ID ngẫu nhiên của từng vé/QR, dùng đối chiếu bản ghi và theo dõi sử dụng." />
            <MeaningCard icon={<BadgeCheck size={16} />} title="ticket_code" detail="Mã tra cứu như SQR-…; không phải secret hay chữ ký." />
            <MeaningCard icon={<KeyRound size={16} />} title="API key" detail="Thông tin xác thực client gửi trong X-API-Key để kiểm tra scope và quota." />
          </div>
        </section>
      </Reveal>

      <Reveal className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <section id="luong-tao-ve" className="panel scroll-mt-24 p-5 md:p-6">
          <SectionHeading
            icon={<Ticket size={18} />}
            eyebrow="Show"
            title="Từ đơn mua đến QR vé"
            description="Tạo Show chưa phát hành vé; vé chỉ được sinh khi thanh toán thành công."
          />
          <ol className="mt-5 grid gap-4">
            <Step number="01" title="Tạo Show" detail="Chủ Show đăng nhập bằng session JWT (JWT_SECRET). Server tạo Show ID và slug công khai." />
            <Step number="02" title="Đặt vé" detail="Khách mua qua trang Show công khai. Server tạo TicketOrder và giữ chỗ; chưa có QR vé." />
            <Step number="03" title="Thanh toán thành công" detail="Backend sinh jti cho từng vé, tạo JWT HS256 bằng QR_JWT_SECRET và lưu vé vào database." />
            <Step number="04" title="Hiển thị QR" detail="Giao diện biến token thành hình QR bằng qrcode.react. Thư viện chỉ vẽ hình, không tạo token hoặc chữ ký." />
          </ol>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/dashboard/shows" className="btn btn-secondary text-sm">Quản lý Show <ArrowRight size={14} /></Link>
            <Link href="/dashboard/tickets" className="btn btn-secondary text-sm">Vé đã mua <ArrowRight size={14} /></Link>
          </div>
        </section>

        <section className="panel p-5 md:p-6">
          <SectionHeading
            icon={<ShieldCheck size={18} />}
            eyebrow="Xác minh"
            title="Online và offline khác nhau"
            description="Scanner API key không ký vé; nó chỉ cho phép gọi endpoint xác minh."
          />
          <div className="mt-5 grid gap-3">
            <ModeCard
              icon={<Wifi size={17} />}
              title="Online · HS256"
              badge="QR_JWT_SECRET"
              description="Scanner gửi QR và API key scope ticket:verify. Server xác minh JWT, đối chiếu vé/Show trong database rồi đánh dấu đã dùng."
            />
            <ModeCard
              icon={<WifiOff size={17} />}
              title="Offline · RS256"
              badge="Private key ký · Public key verify"
              description="Backend ký thêm token offline bằng private RSA key tenant. Scanner dùng public key đã cache để kiểm tra chữ ký và lưu jti đã quét trên thiết bị."
            />
          </div>
          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
            <b className="text-zinc-900">Giới hạn offline:</b> scanner demo chỉ
            chặn quét lặp trên cùng browser/device. Khi mất mạng, nó không nhận
            được revoke mới; các thiết bị offline riêng không chia sẻ trạng thái
            đã dùng cho nhau.
          </div>
        </section>
      </Reveal>

      <Reveal className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <section className="panel p-5 md:p-6">
          <SectionHeading
            icon={<Code2 size={18} />}
            eyebrow="API Rental"
            title="Cấp key và tạo QR tích hợp"
            description="Key xác thực client; token QR đại diện cho resource của ứng dụng bên ngoài."
          />
          <div className="mt-5 grid gap-3">
            <FlowCard number="01" title="Cấp API key" detail="Sinh sq_live_… hoặc sq_test_… từ random bytes. Raw key chỉ trả một lần; database lưu HMAC-SHA256 với API_KEY_PEPPER." />
            <FlowCard number="02" title="Gọi tạo QR" detail="Client gửi X-API-Key có scope qr:create đến POST /api/v1/qr-codes. Backend tạo jti, ticket_code SQR-… và JWT HS256." />
            <FlowCard number="03" title="Đọc hoặc thu hồi" detail="qr:read dùng để đọc/lấy SVG; qr:create dùng tạo hoặc revoke. Quota, thời hạn và trạng thái QR được backend quản lý." />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/dashboard/pages/thue-api" className="btn btn-primary text-sm">Mở trang Thuê API <ArrowRight size={14} /></Link>
            <Link href="/dashboard/api-keys" className="btn btn-secondary text-sm">Quản lý API key <ArrowRight size={14} /></Link>
          </div>
        </section>

        <section className="panel p-5 md:p-6">
          <SectionHeading
            icon={<CircleOff size={18} />}
            eyebrow="Vận hành"
            title="Dừng service có được không?"
            description="Được, nhưng các chức năng phụ thuộc service đó sẽ tạm ngừng."
          />
          <div className="mt-5 divide-y divide-zinc-200">
            {ports.map((service) => (
              <div key={service.port} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-900">{service.name}</p>
                  <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 font-mono text-xs text-zinc-600">:{service.port}</span>
                </div>
                <p className="mt-1 text-sm leading-5 text-zinc-600">{service.impact}</p>
                <code className="mt-2 block overflow-x-auto rounded-lg bg-zinc-950 px-3 py-2 text-xs text-zinc-100">{service.command}</code>
              </div>
            ))}
          </div>
          <p className="mt-4 flex gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 text-zinc-600">
            <Server className="mt-0.5 shrink-0 text-zinc-800" size={15} />
            Dừng một service không cần sửa port. Trong Docker Compose, API sẽ
            tiếp tục chạy nhưng route phụ thuộc service bị dừng sẽ lỗi; chạy lại
            bằng <code className="font-mono text-zinc-900">docker compose start &lt;tên-service&gt;</code>.
          </p>
        </section>
      </Reveal>

      <Reveal className="mt-6">
        <section className="panel p-5 md:p-6">
          <SectionHeading
            icon={<RotateCw size={18} />}
            eyebrow="Cần biết"
            title="Hai lưu ý từ luồng code hiện tại"
            description="Tài liệu này phản ánh implementation trong repo; những điểm dưới đây đáng lưu ý khi vận hành."
          />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-sm font-semibold text-zinc-900">Revoke vé Show</p>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                Endpoint verify hiện chuyển tới Ticket Service; nhánh kiểm tra
                vé tại service này chưa đối chiếu bảng RevokedResource. Không nên
                dựa vào revoke để chặn verify online cho tới khi luồng này được
                cập nhật.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-sm font-semibold text-zinc-900">Verify QR API Rental</p>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                Hàm verifyExternal trong QR Service có kiểm tra thêm quota,
                notBefore, gate allowlist và maxUses, nhưng route verify đang
                hoạt động đi qua Ticket Service. Các kiểm tra mở rộng đó chưa
                được áp dụng từ route công khai hiện tại.
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            Không chia sẻ QR_JWT_SECRET, API_KEY_PEPPER, INTERNAL_SERVICE_TOKEN
            hoặc private RSA key với trình duyệt hay thiết bị quét.
          </p>
        </section>
      </Reveal>
    </main>
  );
}

function SectionHeading({
  icon,
  eyebrow,
  title,
  description
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white">
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{eyebrow}</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-zinc-950">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-zinc-600">{description}</p>
      </div>
    </div>
  );
}

function SummaryCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <article className="panel flex items-center gap-3 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-800">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-zinc-500">{title}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-zinc-900">{value}</p>
      </div>
    </article>
  );
}

function MeaningCard({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="p-4 md:p-5">
      <div className="flex items-center gap-2 text-zinc-900">
        {icon}<h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="mt-2 text-sm leading-5 text-zinc-600">{detail}</p>
    </div>
  );
}

function Step({ number, title, detail }: { number: string; title: string; detail: string }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white">{number}</span>
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        <p className="mt-1 text-sm leading-5 text-zinc-600">{detail}</p>
      </div>
    </li>
  );
}

function ModeCard({
  icon,
  title,
  badge,
  description
}: {
  icon: React.ReactNode;
  title: string;
  badge: string;
  description: string;
}) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-zinc-800">{icon}</span>
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        <span className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-[11px] text-zinc-600">{badge}</span>
      </div>
      <p className="mt-2 text-sm leading-5 text-zinc-600">{description}</p>
    </article>
  );
}

function FlowCard({ number, title, detail }: { number: string; title: string; detail: string }) {
  return (
    <article className="flex gap-3 rounded-lg border border-zinc-200 bg-white p-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-800">{number}</span>
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        <p className="mt-1 text-sm leading-5 text-zinc-600">{detail}</p>
      </div>
    </article>
  );
}
