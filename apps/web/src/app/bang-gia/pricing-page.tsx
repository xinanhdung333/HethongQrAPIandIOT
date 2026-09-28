import { Reveal } from "@/components/reveal";
import { money } from "@/lib/api";

export default function PricingPage() {
  return (
    <main className="shell py-16 md:py-24">
      <Reveal>
        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">Bảng giá</h1>
        <p className="mt-4 max-w-2xl text-zinc-600">Rõ phí thuê, phí lắp đặt, phí thiệt hại và hoa hồng gói show.</p>
      </Reveal>
      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {[
          ["Thuê SP-01", `${money(690000)}/tháng`, "Cọc 2tr, lắp đặt 300k, hợp đồng 1/3/12 tháng."],
          ["Thuê SP-02", `${money(1990000)}/tháng`, "Cọc 5tr, phù hợp show lớn và cổng công suất cao."],
          ["White-label Show", "199k + 5%", "Khởi tạo page riêng, payout demo 95%, QR ticket realtime."]
        ].map(([name, price, desc]) => (
          <article key={name} className="panel p-6">
            <h2 className="text-xl font-semibold tracking-tight">{name}</h2>
            <p className="mt-4 text-3xl font-semibold tracking-tight">{price}</p>
            <p className="mt-4 text-sm leading-6 text-zinc-600">{desc}</p>
          </article>
        ))}
      </div>
      <Reveal className="mt-8 panel p-6">
        <h2 className="text-xl font-semibold tracking-tight">Phí thiệt hại</h2>
        <p className="mt-3 text-zinc-600">Mất đền 100%, hỏng đầu quét 1tr. Điều khoản này bắt buộc checkbox khi thuê thiết bị.</p>
      </Reveal>
      <Reveal className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="panel p-6">
          <h2 className="text-2xl font-semibold tracking-tight">Ví dụ đơn thuê</h2>
          <div className="mt-5 grid gap-3 text-sm">
            <div className="flex justify-between"><span>SP-01 Mini · 1 tháng</span><b>{money(690000)}</b></div>
            <div className="flex justify-between"><span>Cọc thiết bị</span><b>{money(2000000)}</b></div>
            <div className="flex justify-between"><span>Phí lắp đặt</span><b>{money(300000)}</b></div>
            <div className="flex justify-between border-t border-zinc-200 pt-3 text-base"><span>Tổng demo</span><b>{money(2990000)}</b></div>
          </div>
        </section>
        <section className="panel p-6">
          <h2 className="text-2xl font-semibold tracking-tight">Hoa hồng show</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600">Vé 100k, bán 2 vé demo: tổng 200k, phí nền tảng 5%, payout còn 190k cho chủ show.</p>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full w-[95%] rounded-full bg-zinc-950" />
          </div>
        </section>
      </Reveal>
    </main>
  );
}
