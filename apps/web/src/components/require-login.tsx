"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function RequireLogin({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = window.localStorage.getItem("smartqr_token");
    if (!token) {
      window.location.replace(`/dang-nhap?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setChecking(false);
  }, [pathname]);

  if (checking) {
    return <main className="shell py-8"><div className="panel p-6 text-sm text-zinc-600">Đang kiểm tra phiên đăng nhập...</div></main>;
  }

  return <>{children}</>;
}
