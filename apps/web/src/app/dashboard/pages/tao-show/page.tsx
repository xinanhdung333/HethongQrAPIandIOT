import { CalendarPlus, Eye, Globe2, Palette, Radio, ScanLine, TicketCheck, WalletCards } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ShowForm } from "@/app/tao-show/show-form";

const checklist = ["Kiểm tra tên show, địa điểm và thời gian mở bán.", "Dùng banner ngang rõ sân khấu hoặc poster chính.", "Kiểm tra giá vé, số lượng vé và tài khoản nhận tiền.", "Mở trang public trên cả desktop và điện thoại.", "Quét thử vé hợp lệ trước khi mở cổng."];

export default function DashboardCreateShowPage() {
  return (
    <main className="mx-auto grid max-w-[1200px] gap-6 py-3 md:py-5">
      <section className="panel overflow-hidden p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">White-label ticketing</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Tạo show bán vé</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              Tạo landing bán vé theo thương hiệu riêng, xem trước tức thời và phát hành QR ticket realtime.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4 xl:w-[560px]">
            <Mini icon={Globe2} label="Public URL" value="/e/slug" />
            <Mini icon={TicketCheck} label="QR ticket" value="JWT" />
            <Mini icon={WalletCards} label="Payout" value="95%" />
            <Mini icon={ScanLine} label="Gate" value="Offline" />
          </div>
        </div>
      </section>

      <ShowForm />

      <div className="grid gap-6 lg:grid-cols-2">
        <aside className="grid h-fit gap-6">
          <section className="panel p-5">
            <div className="flex items-center gap-2">
              <Eye size={18} className="text-zinc-500" />
              <h2 className="font-semibold">Checklist trước khi xuất bản</h2>
            </div>
            <div className="mt-4 grid gap-3">
              {checklist.map((item, index) => (
                <div key={item} className="flex gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm leading-6 text-zinc-700">
                  <span className="grid size-6 shrink-0 place-items-center rounded bg-zinc-900 text-xs font-semibold text-white">{index + 1}</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="font-semibold">Kênh bán sau khi tạo</h2>
            <div className="mt-4 grid gap-3 text-sm text-zinc-600">
              <p className="rounded-lg border border-zinc-200 p-3"><b className="text-zinc-900">Public link</b><br />Gửi link /e/[slug] cho khách mua vé.</p>
              <p className="rounded-lg border border-zinc-200 p-3"><b className="text-zinc-900">Iframe</b><br />Nhúng form bán vé vào landing có sẵn.</p>
              <p className="rounded-lg border border-zinc-200 p-3"><b className="text-zinc-900">Gate app</b><br />Dùng scanner offline JWT khi mất mạng.</p>
            </div>
          </section>
        </aside>
      <section className="panel overflow-hidden">
        <div className="border-b border-zinc-200 p-5">
          <h2 className="font-semibold">Mô hình vận hành show</h2>
          <p className="mt-1 text-sm text-zinc-600">Luồng từ lúc xuất bản đến khi soát vé tại cổng.</p>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-4">
          {([
            [CalendarPlus, "Tạo show", "Nhập nội dung, giá vé và số lượng."],
            [Palette, "Trang trí", "Chọn màu chủ đạo và banner show."],
            [Radio, "Mở bán", "Khách mua vé qua public URL."],
            [ScanLine, "Check-in", "Quét QR realtime hoặc offline."]
          ] satisfies Array<[LucideIcon, string, string]>).map(([Icon, title, desc]) => (
            <article key={String(title)} className="rounded-lg border border-zinc-200 p-4">
              <Icon size={18} className="text-zinc-500" />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{desc}</p>
            </article>
          ))}
        </div>
      </section>
      </div>
    </main>
  );
}

function Mini({ icon: Icon, label, value }: { icon: typeof Radio; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <Icon size={17} className="text-zinc-500" />
      <span className="mt-3 block text-xs font-medium uppercase text-zinc-500">{label}</span>
      <b className="mt-1 block text-xl">{value}</b>
    </div>
  );
}
