"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { api } from "@/lib/api";

type MeResult = { user: { id: string; email: string; role: string } };
type ProfileResult = MeResult & { access_token: string };

export function ProfileForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void api<MeResult>("/auth/me", { cache: "no-store" })
      .then((result) => {
        setEmail(result.user.email);
        setRole(result.user.role);
      })
      .catch(() => setMessage("Không thể tải hồ sơ hiện tại."));
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const body: { email?: string; password?: string } = {};
      if (email.trim()) body.email = email.trim();
      if (password.trim()) body.password = password.trim();
      const result = await api<ProfileResult>("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify(body)
      });
      window.localStorage.setItem("smartqr_token", result.access_token);
      setEmail(result.user.email);
      setRole(result.user.role);
      setPassword("");
      setMessage("Đã cập nhật hồ sơ.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể cập nhật hồ sơ.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel grid gap-5 p-5">
      <div>
        <h2 className="font-semibold">Hồ sơ cá nhân</h2>
        <p className="mt-1 text-sm text-zinc-600">Cập nhật email đăng nhập hoặc đổi mật khẩu cho tài khoản hiện tại.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Email
          <input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Vai trò
          <input className="field bg-zinc-50 text-zinc-500" value={role || "CUSTOMER"} readOnly />
        </label>
      </div>
      <label className="grid gap-2 text-sm font-medium">
        Mật khẩu mới
        <input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} placeholder="Để trống nếu không đổi" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary text-sm" disabled={loading}>
          <Save size={16} />
          {loading ? "Đang lưu" : "Lưu thay đổi"}
        </button>
        {message && <p className="text-sm font-medium text-zinc-600">{message}</p>}
      </div>
    </form>
  );
}
