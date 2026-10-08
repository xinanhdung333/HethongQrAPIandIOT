"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";
import { motion } from "framer-motion";

const links = [
  ["chả co gì", "/#san-pham"],
  ["Sản phẩm & thuê", "/dashboard/pages/san-pham"],
  ["Tạo show", "/#tao-show"],
  ["Linh kiện", "/#linh-kien"],
  ["Bảng giá", "/#bang-gia"],
  ["Thuê API", "/#thue-api"],
  ["Tài liệu", "/#docs"]
] as const;

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const syncAuthState = () => setIsLoggedIn(Boolean(window.localStorage.getItem("smartqr_token")));
    syncAuthState();
    window.addEventListener("storage", syncAuthState);
    return () => window.removeEventListener("storage", syncAuthState);
  }, [pathname]);

  async function logout() {
    const token = window.localStorage.getItem("smartqr_token");
    if (token) {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => undefined);
    }
    window.localStorage.removeItem("smartqr_token");
    setIsLoggedIn(false);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/82 backdrop-blur-xl">
      <div className="shell flex h-16 items-center justify-between gap-4">
        <Link href="/" className="focus-ring flex items-center rounded-lg" aria-label="SmartQR">
          <img src="/brand/smartqr-logo.svg" alt="SmartQR" width={136} height={40} className="h-10 w-auto" />
        </Link>

        {!isLoggedIn ? (
          <nav className="hidden items-center gap-1 text-sm font-medium text-zinc-600 md:flex">
           
          </nav>
        ) : (
          <div className="flex-1" />
        )}

        <div className="flex items-center gap-2">
         
          {isLoggedIn ? (
            <button type="button" onClick={() => void logout()} className="hidden text-sm font-medium text-zinc-600  transition hover:text-zinc-950 sm:inline-flex">
              Đăng xuất
            </button>
          ) : (
            <Link href="/dang-nhap" className="hidden text-sm btn btn-secondary focus-ring bg-white/80 text-sm btn btn-secondary focus-ring bg-white/80 text-sm font-medium text-zinc-600 transition hover:text-zinc-950 sm:inline-flex">
              Đăng nhập
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
