import { CalendarPlus, Eye, Radio, TicketCheck } from "lucide-react";
import { ShowForm } from "@/app/tao-show/show-form";
import { Reveal } from "@/components/reveal";

const checklist = [
  "Kiem tra ten show, dia diem va thoi gian mo ban.",
  "Upload banner ty le ngang de trang ban ve hien thi dep.",
  "Nhap gia ve, so luong ve va tai khoan nhan tien demo.",
  "Sau khi tao, mo public URL de xem trang /e/[slug]."
];

export default function DashboardCreateShowPage() {
  return (
    <div className="grid gap-6">
      <Reveal>
        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-500">
                <CalendarPlus size={16} />
                Quan ly trang ban ve
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 md:text-4xl">
                Tao show white-label
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
                Tao landing ban ve rieng cho tung su kien, cau hinh banner, mau chu dao, gia ve va thong tin nhan tien demo.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:w-[360px]">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <Radio className="text-zinc-500" size={18} />
                <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">Live</p>
                <p className="text-xs font-medium text-zinc-500">Tao public URL</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <TicketCheck className="text-zinc-500" size={18} />
                <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">QR</p>
                <p className="text-xs font-medium text-zinc-500">Ve va iframe demo</p>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <ShowForm />
        </div>

        <Reveal className="grid h-fit gap-6">
          <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Eye size={18} className="text-zinc-500" />
              <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Checklist truoc khi publish</h2>
            </div>
            <div className="mt-5 grid gap-3">
              {checklist.map((item) => (
                <div key={item} className="flex gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm leading-6 text-zinc-700">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-zinc-950" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Sau khi tao show</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              He thong se tra ve public URL va embed iframe. Ban co the mo trang ban ve, copy iframe de nhung vao landing hoac chia se link cho doi ngu van hanh.
            </p>
          </section>
        </Reveal>
      </div>
    </div>
  );
}
