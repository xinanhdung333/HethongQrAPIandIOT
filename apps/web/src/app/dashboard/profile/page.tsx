"use client";

import Link from "next/link";
import { Code2, KeyRound, Radio, ShieldCheck, Ticket, Truck, Wallet } from "lucide-react";
import { ProfileForm } from "./profile-form";

const shortcuts = [
  ["Đơn thuê", "/dashboard/rentals", Truck, "Xem thiết bị đã thuê, gate ID và trạng thái hoàn trả."],
  ["Show", "/dashboard/shows", Radio, "Quản lý các show đã mở, vé đã bán và link public."],
  ["Vé QR", "/dashboard/tickets", Ticket, "Xem các đơn vé, QR JWT và trạng thái quét."],
  ["API Keys", "/dashboard/api-keys", KeyRound, "Theo dõi prefix và quota API key đang dùng."]
  ,["IoT Developer", "/dashboard/iot-developer", Code2, "Mô phỏng thiết bị quét và kiểm tra chế độ offline."]
  ,["Payout", "/dashboard/settings/payout", Wallet, "Quản lý tài khoản ngân hàng hoặc ví nhận tiền."]
];

export default function ProfilePage() {
  return (
    <main className="mx-auto min-w-0 max-w-[1200px] py-3 md:py-5">
      <div>
        <p className="text-sm font-medium text-zinc-500">Account Settings</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Tài khoản cá nhân</h1>
        <p className="mt-2 text-sm text-zinc-600">Quản lý thông tin đăng nhập, quyền truy cập và các dịch vụ của bạn.</p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <ProfileForm />
        <section className="panel overflow-hidden"><div className="border-b border-amber-200 bg-amber-50/60 p-5"><div className="flex items-center gap-2"><ShieldCheck size={17} className="text-amber-700" /><h2 className="font-semibold">Quyền và bảo mật</h2></div><p className="mt-1 text-sm text-zinc-500">Các nguyên tắc bảo vệ tài khoản hiện tại.</p></div><div className="grid gap-3 p-5 text-sm text-zinc-600">
            <p className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-600" />API key chỉ hiển thị prefix để tránh lộ khóa thật.</p>
            <p className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-600" />Mật khẩu mới cần tối thiểu 8 ký tự.</p>
            <p className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-600" />JWT được cấp lại sau khi đổi email hoặc mật khẩu.</p>
          </div>
        </section>
      </div>

      <section className="mt-6">
        <h2 className="text-xl font-semibold tracking-tight">Lối tắt cá nhân</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {shortcuts.map(([label, href, Icon, desc]) => (
            <Link key={href as string} href={href as string} className="panel block p-5 transition duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                  <Icon size={17} />
                </span>
                <b>{label as string}</b>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{desc as string}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
