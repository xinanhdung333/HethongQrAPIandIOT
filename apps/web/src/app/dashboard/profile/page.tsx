"use client";

import Link from "next/link";
import { KeyRound, Radio, Ticket, Truck } from "lucide-react";
import { ProfileForm } from "./profile-form";

const shortcuts = [
  ["Đơn thuê", "/dashboard/rentals", Truck, "Xem thiết bị đã thuê, gate ID và trạng thái hoàn trả."],
  ["Show", "/dashboard/shows", Radio, "Quản lý các show đã mở, vé đã bán và link public."],
  ["Vé QR", "/dashboard/tickets", Ticket, "Xem các đơn vé, QR JWT và trạng thái quét."],
  ["API Keys", "/dashboard/api-keys", KeyRound, "Theo dõi prefix và quota API key đang dùng."]
];

export default function ProfilePage() {
  return (
    <div>
      <div>
        <p className="text-sm font-medium text-zinc-500">Tài khoản</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Cá nhân</h1>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <ProfileForm />
        <section className="panel p-5">
          <h2 className="font-semibold">Quyền truy cập</h2>
          <div className="mt-4 grid gap-3 text-sm text-zinc-600">
            <p>API key chỉ hiện prefix trong dashboard để tránh lộ khóa thật.</p>
            <p>Mật khẩu mới cần tối thiểu 8 ký tự.</p>
            <p>Sau khi đổi email hoặc mật khẩu, hệ thống cấp lại JWT mới cho phiên hiện tại.</p>
          </div>
        </section>
      </div>

      <section className="mt-6">
        <h2 className="text-xl font-semibold tracking-tight">Lối tắt cá nhân</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {shortcuts.map(([label, href, Icon, desc]) => (
            <Link key={href as string} href={href as string} className="panel block p-5 transition hover:-translate-y-0.5 hover:border-zinc-300">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900">
                  <Icon size={17} />
                </span>
                <b>{label as string}</b>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{desc as string}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
