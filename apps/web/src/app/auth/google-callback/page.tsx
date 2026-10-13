"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function GoogleCallbackPage() {
  const router = useRouter();
  useEffect(() => { const token = new URLSearchParams(window.location.search).get("token"); if (token) { localStorage.setItem("smartqr_token", token); router.replace("/dashboard"); } else router.replace("/dang-nhap?oauth_error=google"); }, [router]);
  return <main className="flex min-h-screen items-center justify-center text-sm text-zinc-500">Đang hoàn tất đăng nhập Google...</main>;
}
