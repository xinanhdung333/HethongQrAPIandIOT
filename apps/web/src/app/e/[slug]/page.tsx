import { Calendar, MapPin } from "lucide-react";
import { BuyForm } from "./buy-form";
import { api, money, Show } from "@/lib/api";

export default async function EventPage({ params }: { params: { slug: string } }) {
  const show = await api<Show>(`/e/${params.slug}`);
  const percent = Math.round((show.soldTickets / show.totalTickets) * 100);
  return (
    <main>
      <section className="min-h-[calc(100vh-64px)] border-b border-zinc-200 bg-zinc-950 text-white">
        <div className="grid lg:grid-cols-[1fr_420px]">
          <div className="min-h-[460px] bg-cover bg-center p-8 md:p-12" style={{ backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.72), rgba(0,0,0,.18)), url(${show.bannerUrl})` }}>
            <div className="max-w-2xl pt-16">
              <h1 className="text-5xl font-semibold leading-tight tracking-tight md:text-7xl">{show.name}</h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-200">{show.description}</p>
              <div className="mt-8 grid gap-3 text-sm text-zinc-200">
                <span className="flex items-center gap-2"><Calendar size={16} />{new Date(show.startAt).toLocaleString("vi-VN")}</span>
                <span className="flex items-center gap-2"><MapPin size={16} />{show.location}</span>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 text-zinc-900 md:p-10">
            <BuyForm slug={show.slug} price={show.ticketPrice} />
            <div className="mt-6 panel p-5">
              <div className="flex justify-between text-sm"><span>Đã bán</span><b>{show.soldTickets}/{show.totalTickets}</b></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full rounded-full bg-zinc-900" style={{ width: `${percent}%` }} />
              </div>
              <p className="mt-4 text-sm text-zinc-600">Giá vé {money(show.ticketPrice)}. Payout demo cho chủ show là 95% sau khi paid.</p>
            </div>
          </div>
        </div>
      </section>
      <section className="shell py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            ["Vé QR", "Mỗi vé sinh một QR JWT riêng, dùng để soát tại cổng."],
            ["Check-in nhanh", "Quét hợp lệ một lần, jti sẽ bị revoke để chống dùng lại."],
            ["Cập nhật realtime", "Chủ show xem số vé bán và lượt quét nhảy ngay trên dashboard."]
          ].map(([title, desc]) => (
            <article key={title} className="panel p-6">
              <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{desc}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
