"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cpu, UserRound } from "lucide-react";
import { motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";

const links = [
  ["Sản phẩm", "/san-pham"],
  ["Thuê thiết bị", "/thue-thiet-bi"],
  ["Tạo show", "/tao-show"],
  ["Linh kiện", "/linh-kien"],
  ["Bảng giá", "/bang-gia"],
  ["Thuê API", "/thue-api"],
  ["Tài liệu", "/docs"]
];

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
        <Link href="/" className="focus-ring flex items-center gap-2 rounded-lg font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
            <Cpu size={18} />
          </span>
          SmartQR
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-zinc-600 md:flex">
          {links.map(([label, href]) => (
            <Link key={href} href={href} className="focus-ring relative rounded-lg px-2 py-1 transition hover:text-zinc-950">
              {(pathname === href || (href !== "/" && pathname.startsWith(`${href}/`))) && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 -z-10 rounded-lg bg-zinc-100"
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}
                />
              )}
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="btn btn-secondary focus-ring bg-white/80 text-sm">
            <UserRound size={16} />
            Cá nhân
          </Link>
          {isLoggedIn ? (
            <button type="button" onClick={() => void logout()} className="hidden text-sm font-medium text-zinc-600 transition hover:text-zinc-950 sm:inline-flex">
              Đăng xuất
            </button>
          ) : (
            <Link href="/dang-nhap" className="hidden text-sm font-medium text-zinc-600 transition hover:text-zinc-950 sm:inline-flex">
              Đăng nhập
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
