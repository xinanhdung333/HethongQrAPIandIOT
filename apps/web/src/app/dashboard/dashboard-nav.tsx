"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Banknote,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  CalendarPlus,
  ChevronDown,
  ChevronsRight,
  Code2,
  FileClock,
  FileText,
  Gift,
  KeyRound,
  LayoutDashboard,
  type LucideIcon,
  Menu,
  Moon,
  Package,
  Radio,
  QrCode,
  ReceiptText,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  Tags,
  Ticket,
  Truck,
  UserRound,
  Webhook,
  WifiOff,
  X
} from "lucide-react";
import { API_URL } from "@/lib/api";

const pageNav = [
  ["Sản phẩm & thuê", "/dashboard/pages/san-pham", Package],
  ["Tạo show", "/dashboard/pages/tao-show", CalendarPlus],
  ["Linh kiện", "/dashboard/pages/linh-kien", Boxes],
  ["Bảng giá", "/dashboard/pages/bang-gia", Tags],
  ["Thuê API", "/dashboard/pages/thue-api", Code2],
  ["QR & Vé", "/dashboard/pages/qr-ve", QrCode],
  ["Tài liệu", "/dashboard/pages/docs", BookOpen]
] as const;

const primaryNav = [
  ["Tổng quan", "/dashboard", LayoutDashboard],
  ["Đơn thuê", "/dashboard/rentals", Truck],
  ["Đơn thuê API", "/dashboard/api-rental", ReceiptText],
  ["Show", "/dashboard/shows", Radio],
  ["API Keys", "/dashboard/api-keys", KeyRound],
  ["IoT Developer", "/dashboard/iot-developer", Code2],
  ["Giao dịch", "/dashboard/payments", Banknote],
  ["Payout", "/dashboard/settings/payout", Settings],
  ["Vé đã mua", "/dashboard/tickets", Ticket],
  ["Tài liệu nội bộ", "/dashboard/documents", FileText],
  ["Quét thử", "/dashboard/scan", ScanLine],
  ["Cổng offline", "/dashboard/gate-offline", WifiOff],
  ["Cá nhân", "/dashboard/profile", UserRound]
] as const;

const apiKeyChildren = [
  ["keys", "Danh sách key", "/dashboard/api-keys#keys", KeyRound],
  ["secrets", "Rental secrets", "/dashboard/api-keys#secrets", ShieldCheck],
  ["analytics", "Analytics", "/dashboard/api-keys#analytics", BarChart3],
  ["webhooks", "Webhook", "/dashboard/api-keys#webhooks", Webhook],
  ["audit", "Audit logs", "/dashboard/api-keys#audit", FileClock]
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav() {
  const [apiOpen, setApiOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setApiOpen(window.location.pathname.startsWith("/dashboard/api-keys"));
    setCollapsed(window.localStorage.getItem("smartqr_sidebar_collapsed") === "true");
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.documentElement.classList.toggle("dashboard-sidebar-collapsed", collapsed);
    window.localStorage.setItem("smartqr_sidebar_collapsed", String(collapsed));
    return () => document.documentElement.classList.remove("dashboard-sidebar-collapsed");
  }, [collapsed]);

  const currentTitle = useMemo(() => {
    const allItems = [...primaryNav, ...pageNav];
    return allItems.find(([, href]) => isActive(pathname, href))?.[0] ?? "Tổng quan";
  }, [pathname]);

  function selectApiSection(sectionId: string, href: string) {
    if (pathname.startsWith("/dashboard/api-keys")) {
      window.history.replaceState(null, "", `#${sectionId}`);
      window.dispatchEvent(new CustomEvent("smartqr:api-section", { detail: sectionId }));
      setMobileOpen(false);
      return;
    }

    router.push(href);
  }

  async function logout() {
    const token = window.localStorage.getItem("smartqr_token");
    if (token) {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => undefined);
    }
    window.localStorage.removeItem("smartqr_token");
    setAccountOpen(false);
    router.push("/");
    router.refresh();
  }

  function renderNavItem(label: string, href: string, Icon: LucideIcon) {
    const active = isActive(pathname, href);

    return (
      <Link
        key={href}
        href={href}
        title={collapsed ? label : undefined}
        className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${collapsed ? "justify-center" : ""} ${
          active ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-300 hover:bg-white/10 hover:text-white"
        }`}
      >
        <Icon size={18} className="shrink-0" />
        {!collapsed && label}
      </Link>
    );
  }

  const sidebar = (
    <aside className={`flex h-full flex-col bg-zinc-950 text-zinc-100 transition-[width] duration-200 ${collapsed ? "w-20" : "w-64"}`}>
      <div className={`flex h-20 items-center gap-3 px-4 ${collapsed ? "justify-center" : ""}`}>
        <div className="grid size-10 place-items-center rounded-lg bg-zinc-800 text-lg font-bold ring-1 ring-white/10">S</div>
        {!collapsed && (
          <div>
            <p className="text-lg font-semibold leading-tight tracking-tight">SmartQR</p>
            <p className="text-xs text-zinc-400">Platform</p>
          </div>
        )}
      </div>

      {!collapsed && (
        <>
          <div className="px-6 pb-5">
            <label className="flex h-11 items-center gap-2 rounded-lg bg-white/10 px-3 text-sm text-zinc-300 ring-1 ring-white/10">
              <Search size={17} />
              <input className="w-full bg-transparent outline-none placeholder:text-zinc-500" placeholder="Tìm kiếm" />
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300">Ctrl</span>
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300">K</span>
            </label>
          </div>

          <div className="flex items-center justify-between px-6 pb-4 text-sm text-zinc-300">
            <span>Test mode</span>
            <span className="relative h-4 w-8 rounded-full bg-zinc-700">
              <span className="absolute right-0.5 top-0.5 size-3 rounded-full bg-white shadow-sm" />
            </span>
          </div>
        </>
      )}

      <nav className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <div className="grid gap-5">
          <div>
            {!collapsed && <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Menu trang</p>}
            <div className="grid gap-1">{pageNav.map(([label, href, Icon]) => renderNavItem(label, href, Icon))}</div>
          </div>

          <div>
            {!collapsed && <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Tài khoản</p>}
            <div className="grid gap-1">
              {primaryNav.map(([label, href, Icon]) => {
                const active = isActive(pathname, href);

                if (href === "/dashboard/api-keys") {
                  return (
                    <div key={href}>
                      <button
                        type="button"
                        title={collapsed ? label : undefined}
                        className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition ${collapsed ? "justify-center" : ""} ${
                          active ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-300 hover:bg-white/10 hover:text-white"
                        }`}
                        onClick={() => setApiOpen((value) => !value)}
                      >
                        <Icon size={18} className="shrink-0" />
                        {!collapsed && <span className="flex-1">{label}</span>}
                        {!collapsed && <ChevronDown size={15} className={`transition-transform duration-200 ${apiOpen ? "rotate-180" : ""}`} />}
                      </button>
                      <div className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out ${apiOpen && !collapsed ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                        <div className="min-h-0">
                          <div className="ml-5 mt-1 grid gap-1 border-l border-white/10 pl-2">
                            {apiKeyChildren.map(([sectionId, childLabel, childHref, ChildIcon]) => (
                              <button
                                key={childHref}
                                type="button"
                                className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-left text-xs font-medium text-zinc-400 transition hover:bg-white/10 hover:text-white"
                                onClick={() => selectApiSection(sectionId, childHref)}
                              >
                                <ChildIcon size={14} />
                                {childLabel}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return renderNavItem(label, href, Icon);
              })}
            </div>
          </div>
        </div>
      </nav>
    </aside>
  );

  return (
    <>
      <div className={`fixed inset-y-0 left-0 z-40 hidden transition-[width] duration-200 lg:block ${collapsed ? "w-20" : "w-64"}`}>{sidebar}</div>

      <div className={`fixed inset-0 z-50 lg:hidden ${mobileOpen ? "" : "pointer-events-none"}`}>
        <div className={`absolute inset-0 bg-zinc-950/40 transition-opacity ${mobileOpen ? "opacity-100" : "opacity-0"}`} onClick={() => setMobileOpen(false)} />
        <div className={`absolute inset-y-0 left-0 w-64 transition-transform duration-200 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
          {sidebar}
        </div>
      </div>

      <header className="dashboard-content sticky top-0 z-30 border-b border-zinc-200 bg-white/92 backdrop-blur lg:ml-64">
        <div className="flex min-h-16 items-center gap-3 px-4 md:px-6">
          <button
            type="button"
            className="grid size-10 place-items-center rounded-lg border border-zinc-200 text-zinc-700 transition hover:bg-zinc-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Mở menu"
          >
            <Menu size={20} />
          </button>
          <button
            type="button"
            className="hidden size-10 place-items-center rounded-lg text-zinc-700 transition hover:bg-zinc-100 lg:grid"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Mở menu" : "Thu menu"}
            title={collapsed ? "Mở menu" : "Thu menu"}
          >
            {collapsed ? <ChevronsRight size={22} /> : <Menu size={24} />}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <Activity className="hidden text-zinc-500 md:block" size={22} />
              <h1 className="truncate text-lg font-semibold tracking-tight text-zinc-800 md:text-xl">{currentTitle}</h1>
              <button type="button" className="hidden items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-900 md:inline-flex">
                Quick menu <ChevronDown size={14} />
              </button>
            </div>
          </div>

          <div className="hidden items-center gap-4 text-sm md:flex">
            <Link href="/dashboard/pages/bang-gia" className="inline-flex items-center gap-1 font-medium text-zinc-700 transition hover:text-zinc-950">
              <Gift size={16} /> Ưu đãi
            </Link>
            <span className="font-medium text-zinc-600">Số dư: <b className="text-emerald-600">0đ</b></span>
          </div>

          <button type="button" className="relative grid size-10 place-items-center rounded-lg text-zinc-600 transition hover:bg-zinc-100" aria-label="Thông báo">
            <Bell size={19} />
            <span className="absolute right-2 top-2 grid size-4 place-items-center rounded-full bg-red-500 text-[10px] font-bold text-white">1</span>
          </button>
          <button type="button" className="hidden size-10 place-items-center rounded-lg text-zinc-600 transition hover:bg-zinc-100 md:grid" aria-label="Giao diện">
            <Moon size={19} />
          </button>
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-zinc-100"
              onClick={() => setAccountOpen((value) => !value)}
              aria-expanded={accountOpen}
              aria-haspopup="menu"
            >
              <span className="grid size-9 place-items-center rounded-lg bg-zinc-950 text-sm font-bold text-white">QR</span>
              <span className="hidden text-sm font-medium text-zinc-700 sm:block">Tài khoản</span>
              <ChevronDown className={`hidden text-zinc-500 transition-transform sm:block ${accountOpen ? "rotate-180" : ""}`} size={14} />
            </button>
            {accountOpen ? (
              <div className="absolute right-0 top-12 z-50 w-48 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg" role="menu">
                <Link
                  href="/dashboard/profile"
                  className="block px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
                  onClick={() => setAccountOpen(false)}
                  role="menuitem"
                >
                  Cài đặt cá nhân
                </Link>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                  onClick={() => void logout()}
                  role="menuitem"
                >
                  Đăng xuất
                </button>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Đóng menu"
          >
            <X size={18} />
          </button>
        </div>
      </header>
    </>
  );
}
