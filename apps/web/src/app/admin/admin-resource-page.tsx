"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api, money } from "@/lib/api";
import { BarChart3, Box, Database, ExternalLink, FileText, History, Home, KeyRound, LogOut, Package, Radio, ShieldCheck, Ticket, Truck, Users } from "lucide-react";

const adminLinks = [
  ["Tổng quan", "/admin", BarChart3],
  ["Lịch sử hoạt động", "/admin/activity", History],
  ["Trang tĩnh & menu", "/admin/content", FileText],
  ["Tất cả sản phẩm", "/admin/products", Package],
  ["Đơn hàng", "/admin/orders", Database],
  ["Show", "/admin/shows", Radio],
  ["Vé", "/admin/tickets", Ticket],
  ["API keys", "/admin/api-keys", KeyRound],
  ["Người dùng", "/admin/users", Users],
  ["Danh mục & hãng", "/admin/categories", FileText],
  ["Tồn kho linh kiện", "/admin/linh-kien/ton-kho", Box],
  ["Tương thích linh kiện", "/admin/linh-kien/tuong-thich", Box],
  ["Kho máy theo serial", "/admin/thue/kho-may", Truck],
  ["Lịch thuê", "/admin/thue/lich-thue", History],
  ["Đơn thuê", "/admin/thue/don-thue", Truck],
] as const;

const publicLinks = [
  ["Trang chủ", "/", Home], ["Sản phẩm", "/san-pham", Package], ["Tạo show", "/tao-show", Radio],
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const token = window.localStorage.getItem("smartqr_token") ?? "";
    setIsAdmin(Boolean(token));
  }, []);

  function logout() {
    window.localStorage.removeItem("smartqr_token");
    window.location.href = "/dang-nhap?next=/admin";
  }

  const navigation = (
    <>
      <div>
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Quản trị</p>
        <nav className="grid gap-1" aria-label="Menu quản trị">
          {adminLinks.map(([label, href, Icon]) => {
            const active = href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} onClick={() => setMobileOpen(false)} className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${active ? "bg-zinc-900 font-medium text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"}`}><Icon size={16} strokeWidth={1.8} />{label}</Link>;
          })}
        </nav>
      </div>
      <div>
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Xem website</p>
        <nav className="grid gap-1" aria-label="Liên kết website">
          {publicLinks.map(([label, href, Icon]) => <Link key={href} href={href} className="flex min-h-10 items-center justify-between rounded-lg px-3 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950"><span className="flex items-center gap-3"><Icon size={16} strokeWidth={1.8} />{label}</span><ExternalLink size={14} className="text-zinc-400" /></Link>)}
        </nav>
      </div>
      {isAdmin && <button type="button" onClick={logout} className="mt-auto flex min-h-10 items-center gap-3 rounded-lg px-3 text-left text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950"><LogOut size={16} />Đăng xuất admin</button>}
    </>
  );

  return <div className="min-h-screen bg-zinc-50 text-zinc-950 lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
    <aside className="sticky top-0 z-30 hidden h-dvh flex-col border-r border-zinc-200 bg-white p-4 lg:flex">
      <Link href="/admin" className="mb-7 flex items-center gap-3 rounded-lg border border-zinc-200 p-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white"><ShieldCheck size={18} /></span>
        <span><b className="block text-sm tracking-tight">SmartQR Admin</b><span className="text-xs text-zinc-500">Bảng điều khiển</span></span>
      </Link>
      <div className="flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto">{navigation}</div>
    </aside>
    <div className="min-w-0">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/95 px-4 backdrop-blur md:px-8 lg:hidden">
        <Link href="/admin" className="flex items-center gap-2 font-semibold tracking-tight"><ShieldCheck size={18} />SmartQR Admin</Link>
        <button type="button" aria-expanded={mobileOpen} aria-controls="admin-mobile-menu" onClick={() => setMobileOpen((open) => !open)} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium">{mobileOpen ? "Đóng" : "Menu"}</button>
      </header>
      {mobileOpen && <div id="admin-mobile-menu" className="fixed inset-x-0 top-14 z-30 max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-zinc-200 bg-white p-4 shadow-sm lg:hidden"><div className="flex min-h-[calc(100dvh-6rem)] flex-col gap-7">{navigation}</div></div>}
      <main className="min-w-0 px-4 py-6 md:px-8 md:py-8"><div className="mx-auto w-full max-w-[1440px]">{children}</div></main>
    </div>
  </div>;
}

export function AdminResourcePage({ title, endpoint, columns, actions }: { title: string; endpoint: string; columns: string[]; actions?: React.ReactNode }) {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => { void api<any>(endpoint).then((value) => setItems(Array.isArray(value) ? value : value.items ?? [])).catch(() => setItems([])); }, [endpoint]);
  const filtered = items.filter((item) => !q || JSON.stringify(item).toLowerCase().includes(q.toLowerCase()));
  return <AdminShell><main className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-medium text-zinc-500">Admin workspace</p><h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight text-zinc-950">{title}</h1><p className="mt-2 text-sm text-zinc-500">Quản lý dữ liệu và nội dung trên SmartQR.</p></div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">{actions}<input aria-label="Tìm kiếm" className="field w-full bg-white sm:w-56" placeholder="Tìm kiếm..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
    </div>
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-zinc-50 text-[11px] font-semibold uppercase tracking-wide text-zinc-500"><tr>{columns.map((column) => <th key={column} className="px-5 py-3.5">{column}</th>)}</tr></thead><tbody className="divide-y divide-zinc-100">{filtered.map((item) => <tr key={item.id} className="transition-colors hover:bg-zinc-50/70"><td className="max-w-64 truncate px-5 py-4 font-medium text-zinc-900">{item.sku ?? item.serial ?? item.id}</td><td className="px-5 py-4 text-zinc-700">{item.name ?? item.product?.name ?? item.customer?.email ?? "—"}</td><td className="px-5 py-4 text-zinc-700">{item.status ?? item.productType ?? item.rentalDetails?.soLuongKhaDung ?? "—"}</td><td className="px-5 py-4 text-zinc-700">{item.total !== undefined ? money(item.total) : item.tuNgay ? `${new Date(item.tuNgay).toLocaleDateString("vi-VN")} – ${new Date(item.denNgay).toLocaleDateString("vi-VN")}` : "—"}</td><td className="px-5 py-4"><Link className="btn btn-secondary min-h-9 text-xs" href={`/admin/products/${item.id}`}>Mở</Link></td></tr>)}</tbody></table></div>
      {!filtered.length && <p className="border-t border-zinc-100 px-5 py-12 text-center text-sm text-zinc-500">Chưa có dữ liệu phù hợp.</p>}
    </div>
  </main></AdminShell>;
}
