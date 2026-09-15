"use client";

import { useState } from "react";
import Link from "next/link";
import { LogIn, UserPlus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

type AuthResult = { user: { email: string; role: "ADMIN" | "CUSTOMER" }; access_token: string };

export function AuthClient({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    setLoading(true);
    setMessage("");
    try {
      const result = await api<AuthResult>(mode === "login" ? "/auth/login" : "/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: String(formData.get("email")),
          password: String(formData.get("password"))
        })
      });
      window.localStorage.setItem("smartqr_token", result.access_token);
      setMessage(`Đã đăng nhập: ${result.user.email}`);
      const next = searchParams.get("next");
      const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
      router.push(result.user.role === "ADMIN" ? "/admin" : safeNext);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể xác thực");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={submit} className="panel mx-auto grid max-w-md gap-5 p-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{mode === "login" ? "Đăng nhập" : "Đăng ký"}</h1>
        <p className="mt-2 text-sm text-zinc-600">JWT có jti và có thể logout để revoke phiên.</p>
      </div>
      <label className="grid gap-2 text-sm font-medium">Email<input required name="email" type="email" className="field" defaultValue={mode === "login" ? "admin@smartqr.vn" : "demo@smartqr.vn"} /></label>
      <label className="grid gap-2 text-sm font-medium">Mật khẩu<input required name="password" type="password" className="field" defaultValue={mode === "login" ? "admin123456" : ""} minLength={8} /></label>
      {mode === "login" && (
        <div className="grid gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
          <span>Admin: admin@smartqr.vn / admin123456</span>
          <span>User: demo@smartqr.vn / demo123456</span>
        </div>
      )}
      <button className="btn btn-primary" disabled={loading}>
        {mode === "login" ? <LogIn size={16} /> : <UserPlus size={16} />}
        {loading ? "Đang xử lý" : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
      </button>
      {message && <p className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">{message}</p>}
      <Link href={mode === "login" ? "/dang-ky" : "/dang-nhap"} className="text-sm font-medium text-zinc-600 hover:text-zinc-950">
        {mode === "login" ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập"}
      </Link>
    </form>
  );
}
