"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";

export function RequireLogin({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const verify = async () => {
      try {
        const token = window.localStorage.getItem("smartqr_token");
        if (!token) return router.replace(`/dang-nhap?next=${encodeURIComponent(pathname)}`);
        const response = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` }, credentials: "include", signal: controller.signal });
        if (!response.ok) {
          window.localStorage.removeItem("smartqr_token");
          return router.replace(`/dang-nhap?next=${encodeURIComponent(pathname)}`);
        }
        const body = await response.json() as { user?: { role?: string } };
        if (body.user?.role === "ADMIN") return router.replace("/admin");
        if (body.user?.role !== "CUSTOMER") {
          window.localStorage.removeItem("smartqr_token");
          return router.replace(`/dang-nhap?next=${encodeURIComponent(pathname)}`);
        }
        setChecking(false);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        router.replace(`/dang-nhap?next=${encodeURIComponent(pathname)}`);
      }
    };
    void verify();
    return () => controller.abort();
  }, [pathname, router]);

  if (checking) {
    return <main className="shell py-8"><div className="panel p-6 text-sm text-zinc-600">Đang kiểm tra phiên đăng nhập...</div></main>;
  }

  return <>{children}</>;
}
