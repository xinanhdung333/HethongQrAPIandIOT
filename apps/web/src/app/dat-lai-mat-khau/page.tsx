"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

function ResetPasswordForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8 || password !== confirm) return setMessage("Mật khẩu tối thiểu 8 ký tự và phải trùng nhau.");
    setBusy(true); setMessage("");
    try { await api("/auth/reset-password", { method: "POST", body: JSON.stringify({ token: params.get("token"), password }) }); setMessage("Đặt lại mật khẩu thành công. Bạn có thể đăng nhập ngay."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Liên kết không hợp lệ hoặc đã hết hạn."); }
    finally { setBusy(false); }
  }

  return <main className="flex min-h-screen items-center justify-center bg-white px-4 text-zinc-900"><section className="w-full max-w-md rounded-xl border border-zinc-200 p-6 shadow-sm"><h1 className="text-2xl font-semibold tracking-tight">Đặt lại mật khẩu</h1><p className="mt-2 text-sm text-zinc-500">Tạo mật khẩu mới cho tài khoản SmartQR.</p><form onSubmit={submit} className="mt-6 grid gap-4"><input className="field" type="password" minLength={8} required placeholder="Mật khẩu mới" value={password} onChange={e => setPassword(e.target.value)} /><input className="field" type="password" minLength={8} required placeholder="Nhập lại mật khẩu" value={confirm} onChange={e => setConfirm(e.target.value)} /><button className="btn btn-primary" disabled={busy}>{busy ? "Đang cập nhật..." : "Cập nhật mật khẩu"}</button></form>{message && <p className="mt-4 text-sm text-zinc-600">{message}</p>}<Link className="mt-5 inline-block text-sm font-medium underline" href="/dang-nhap">Quay lại đăng nhập</Link></section></main>;
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="flex min-h-screen items-center justify-center text-sm text-zinc-500">Đang tải...</main>}><ResetPasswordForm /></Suspense>;
}
