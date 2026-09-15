import Link from "next/link";
import { ArrowRight, KeyRound, Radio, ScanLine, Store } from "lucide-react";
import { QrHeroShowcase } from "@/components/qr-hero-showcase";
import { Reveal } from "@/components/reveal";
import { api, money, Product } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Home() {
  const products = await api<Product[]>("/products").catch(() => []);
  return (
    <main>
      <QrHeroShowcase />

      <section className="shell py-24 md:py-32">
        <Reveal>
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">3 gói sẵn sàng bán</h2>
            <p className="mt-4 text-zinc-600">Mỗi gói có flow demo riêng: thuê thiết bị, tạo show, mua vé, quét QR và xem realtime.</p>
          </div>
        </Reveal>
        <Reveal className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            ["Gói 1", "API + Thiết bị", "Gym, cổng vào, sự kiện có web riêng.", KeyRound, "/thue-thiet-bi"],
            ["Gói 2", "White-label Show", "Tạo landing bán vé riêng cho show.", Radio, "/tao-show"],
            ["Gói 3", "Linh kiện", "GM65, ESP32, Servo, Vỏ, OLED.", Store, "/linh-kien"]
          ].map(([tag, title, desc, Icon, href]) => (
            <Link href={href as string} key={title as string} className="panel motion-link group p-6">
              <Icon className="text-zinc-900" />
              <p className="mt-5 text-sm font-medium text-zinc-500">{tag as string}</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title as string}</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{desc as string}</p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-zinc-900 opacity-70 transition group-hover:opacity-100">
                Mở flow <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </Reveal>
      </section>

      <section className="border-y border-zinc-200 bg-zinc-50 py-24 md:py-32">
        <div className="shell">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">Quy trình vận hành</h2>
            <p className="mt-4 max-w-2xl text-zinc-600">Từ tạo đơn đến soát vé đều đi qua một luồng thống nhất để demo nhanh và mở rộng được.</p>
          </Reveal>
          <Reveal className="mt-10 grid gap-4 md:grid-cols-4">
            {[
              ["01", "Tạo đơn", "Khách thuê thiết bị hoặc tạo show white-label."],
              ["02", "Thanh toán", "PayOS mock tự paid sau 5 giây, có sẵn biến môi trường cho PayOS thật."],
              ["03", "Sinh QR", "Ticket JWT có jti riêng, lưu trạng thái chống quét lại."],
              ["04", "Realtime", "Dashboard nhận event bán vé và verify ngay khi cổng quét."]
            ].map(([step, title, desc]) => (
              <article key={step} className="panel p-6">
                <span className="text-sm font-semibold text-zinc-500">{step}</span>
                <h3 className="mt-4 text-xl font-semibold tracking-tight">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600">{desc}</p>
              </article>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-zinc-950 py-24 text-zinc-100 md:py-32">
        <div className="shell">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">Bảng giá nhanh</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-zinc-800 p-6"><b>SP-01 Mini</b><p className="mt-3 text-zinc-400">{money(products[0]?.priceRentMonth ?? 690000)}/tháng + cọc 2tr</p></div>
              <div className="rounded-xl border border-zinc-800 p-6"><b>White-label Show</b><p className="mt-3 text-zinc-400">199k khởi tạo + 5% mỗi vé</p></div>
              <div className="rounded-xl border border-zinc-800 p-6"><b>Linh kiện</b><p className="mt-3 text-zinc-400">Bán lẻ và lắp theo yêu cầu</p></div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="shell py-24 md:py-32">
        <Reveal className="grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">FAQ</h2>
            <p className="mt-4 text-zinc-600">PayOS đang ở chế độ mock, webhook demo tự mark paid sau 5 giây và có sẵn env để đổi sang thật.</p>
          </div>
          <Link href="/dashboard/scan" className="panel flex items-center justify-between p-6">
            <span><b>Quét thử QR</b><span className="mt-1 block text-sm text-zinc-600">Dùng camera hoặc dán JWT để verify demo.</span></span>
            <ScanLine />
          </Link>
        </Reveal>
      </section>
    </main>
  );
}
