"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function RequireLogin({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const token = window.localStorage.getItem("smartqr_token");
    if (!token) {
      window.location.replace(`/dang-nhap?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname]);

  return <>{children}</>;
}
