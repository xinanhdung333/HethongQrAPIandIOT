"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AdminShell } from "./admin-resource-page";
import { invalidateAdminDataCache } from "./admin-console";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";

type AdminUser = { id: string; email: string; role: "ADMIN" | "CUSTOMER"; createdAt: string };
type Category = { id: string; name: string; slug: string; parentId?: string | null; _count?: { products: number } };
type CatalogProduct = { id: string; sku?: string | null; slug: string; name: string; type: "IOT_MINI" | "IOT_PRO" | "COMPONENT"; productType?: "LINH_KIEN" | "THIET_BI_BAN" | "THIET_BI_THUE" | null; categoryId?: string | null; category?: Category | null; priceSell: number; priceRentMonth: number; depositFee: number; stock: number; images?: string[]; specs?: Record<string, unknown>; status?: string };

function Notice({ value, error }: { value: string; error?: boolean }) {
  return value ? <p role="status" className={`rounded-lg border px-3 py-2 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{value}</p> : null;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-zinc-950/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={title} className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-xl font-semibold tracking-tight">{title}</h2><button type="button" className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900" aria-label="Đóng" onClick={onClose}><X size={18}/></button></div>
      {children}
    </section>
  </div>;
}

export function AdminUsersManager() {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  async function refresh() { setItems(await api<AdminUser[]>("/admin/users")); }
  useEffect(() => { void refresh().catch((e) => { setMessage(e.message); setIsError(true); }); }, []);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; setBusy(true); setMessage(""); setIsError(false);
    try { const form = new FormData(formElement); await api("/admin/users", { method: "POST", body: JSON.stringify({ email: form.get("email"), password: form.get("password"), role: form.get("role") }) }); formElement.reset(); setCreating(false); invalidateAdminDataCache(); await refresh(); setMessage("Đã tạo người dùng."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Không tạo được người dùng."); setIsError(true); }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>, user: AdminUser) {
    event.preventDefault(); setBusy(true); setMessage(""); setIsError(false);
    try { const form = new FormData(event.currentTarget); const password = String(form.get("password") ?? ""); await api(`/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ email: form.get("email"), role: form.get("role"), ...(password ? { password } : {}) }) }); invalidateAdminDataCache(); await refresh(); setEditing(null); setMessage("Đã cập nhật người dùng."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Không cập nhật được người dùng."); setIsError(true); }
    finally { setBusy(false); }
  }
  async function remove(user: AdminUser) {
    if (!window.confirm(`Xóa tài khoản ${user.email}?`)) return;
    setBusy(true); setMessage(""); setIsError(false);
    try { await api(`/admin/users/${user.id}`, { method: "DELETE" }); invalidateAdminDataCache(); await refresh(); setMessage("Đã xóa người dùng."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Không xóa được người dùng."); setIsError(true); }
    finally { setBusy(false); }
  }
  return <AdminShell><main className="space-y-6"><header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-zinc-500">Admin workspace</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Người dùng</h1><p className="mt-2 text-sm text-zinc-500">Tạo tài khoản, đổi email/vai trò, đặt lại mật khẩu hoặc xóa tài khoản chưa phát sinh dữ liệu.</p></div><button className="btn btn-primary" onClick={() => { setIsError(false); setCreating(true); }}><Plus size={16}/>Thêm người dùng</button></header>
    <Notice value={message} error={isError} />
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr><th className="px-5 py-3">Email</th><th className="px-5 py-3">Vai trò</th><th className="px-5 py-3">Ngày tạo</th><th className="px-5 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-zinc-100">{items.map((user) => <tr key={user.id}>
      <td className="px-5 py-4 font-medium">{user.email}</td><td className="px-5 py-4">{user.role === "ADMIN" ? "Admin" : "Khách hàng"}</td><td className="px-5 py-4">{new Date(user.createdAt).toLocaleDateString("vi-VN")}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button className="btn btn-secondary min-h-9 px-3 text-xs" onClick={() => { setIsError(false); setEditing(user); }}><Pencil size={14} />Sửa</button><button className="btn btn-secondary min-h-9 px-3 text-xs text-red-700" disabled={busy} onClick={() => void remove(user)}><Trash2 size={14} />Xóa</button></div></td>
    </tr>)}</tbody></table>{!items.length && <p className="p-8 text-center text-sm text-zinc-500">Chưa có người dùng.</p>}</div>
    {creating && <Modal title="Tạo tài khoản" onClose={() => setCreating(false)}><form onSubmit={(event) => void create(event)} className="grid gap-4"><label className="grid gap-1 text-sm text-zinc-600">Email<input className="field" name="email" type="email" required/></label><label className="grid gap-1 text-sm text-zinc-600">Mật khẩu<input className="field" name="password" type="password" minLength={8} required/><span className="text-xs text-zinc-500">Tối thiểu 8 ký tự.</span></label><label className="grid gap-1 text-sm text-zinc-600">Vai trò<select className="field" name="role" defaultValue="CUSTOMER"><option value="CUSTOMER">Khách hàng</option><option value="ADMIN">Admin</option></select></label><button className="btn btn-primary" disabled={busy}><Plus size={16}/>Tạo tài khoản</button></form></Modal>}
    {editing && <Modal title="Sửa người dùng" onClose={() => setEditing(null)}><form onSubmit={(event) => void save(event, editing)} className="grid gap-4"><label className="grid gap-1 text-sm text-zinc-600">Email<input className="field" name="email" type="email" defaultValue={editing.email} required/></label><label className="grid gap-1 text-sm text-zinc-600">Mật khẩu mới<input className="field" name="password" type="password" minLength={8} placeholder="Để trống nếu không đổi"/></label><label className="grid gap-1 text-sm text-zinc-600">Vai trò<select className="field" name="role" defaultValue={editing.role}><option value="CUSTOMER">Khách hàng</option><option value="ADMIN">Admin</option></select></label><button className="btn btn-primary" disabled={busy}><Save size={16}/>Lưu thay đổi</button></form></Modal>}
  </main></AdminShell>;
}

export function AdminCategoriesManager() {
  const [items, setItems] = useState<Category[]>([]); const [message, setMessage] = useState(""); const [error, setError] = useState(false); const [editing, setEditing] = useState<Category | null>(null); const [creating, setCreating] = useState(false); const [busy, setBusy] = useState(false);
  async function refresh() { setItems(await api<Category[]>("/admin/categories")); }
  useEffect(() => { void refresh().catch((e) => { setMessage(e.message); setError(true); }); }, []);
  async function save(event: FormEvent<HTMLFormElement>, id?: string) {
    event.preventDefault(); const formElement = event.currentTarget; setBusy(true); setMessage(""); setError(false);
    try { const form = new FormData(formElement); const data = { name: String(form.get("name")).trim(), slug: String(form.get("slug")).trim() }; await api(id ? `/admin/categories/${id}` : "/admin/categories", { method: id ? "PATCH" : "POST", body: JSON.stringify(data) }); invalidateAdminDataCache(); await refresh(); setEditing(null); setCreating(false); setMessage(id ? "Đã cập nhật danh mục." : "Đã tạo danh mục."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Không lưu được danh mục."); setError(true); }
    finally { setBusy(false); }
  }
  async function remove(item: Category) { if (!window.confirm(`Xóa danh mục ${item.name}?`)) return; setBusy(true); setMessage(""); setError(false); try { await api(`/admin/categories/${item.id}`, { method: "DELETE" }); invalidateAdminDataCache(); await refresh(); setMessage("Đã xóa danh mục."); } catch (e) { setMessage(e instanceof Error ? e.message : "Không xóa được danh mục đang được sử dụng."); setError(true); } finally { setBusy(false); } }
  return <AdminShell><main className="space-y-6"><header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-zinc-500">Admin workspace</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Danh mục & hãng</h1><p className="mt-2 text-sm text-zinc-500">Danh mục có sản phẩm hoặc danh mục con sẽ không thể xóa.</p></div><button className="btn btn-primary" onClick={() => { setError(false); setCreating(true); }}><Plus size={16}/>Thêm danh mục</button></header><Notice value={message} error={error}/>
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr><th className="px-5 py-3">Tên</th><th className="px-5 py-3">Slug</th><th className="px-5 py-3">Sản phẩm</th><th className="px-5 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-zinc-100">{items.map((item) => <tr key={item.id}><td className="px-5 py-4 font-medium">{item.name}</td><td className="px-5 py-4 text-zinc-600">{item.slug}</td><td className="px-5 py-4">{item._count?.products ?? "—"}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button className="btn btn-secondary min-h-9 text-xs" onClick={() => { setError(false); setEditing(item); }}><Pencil size={14}/>Sửa</button><button className="btn btn-secondary min-h-9 text-xs text-red-700" disabled={busy} onClick={() => void remove(item)}><Trash2 size={14}/>Xóa</button></div></td></tr>)}</tbody></table>{!items.length && <p className="p-8 text-center text-sm text-zinc-500">Chưa có danh mục.</p>}</div>
    {creating && <Modal title="Thêm danh mục" onClose={() => setCreating(false)}><form onSubmit={(event) => void save(event)} className="grid gap-4"><label className="grid gap-1 text-sm text-zinc-600">Tên danh mục<input className="field" name="name" required autoFocus/></label><label className="grid gap-1 text-sm text-zinc-600">Slug<input className="field" name="slug" placeholder="linh-kien" required/></label><button className="btn btn-primary" disabled={busy}><Plus size={16}/>Tạo danh mục</button></form></Modal>}
    {editing && <Modal title="Sửa danh mục" onClose={() => setEditing(null)}><form onSubmit={(event) => void save(event, editing.id)} className="grid gap-4"><label className="grid gap-1 text-sm text-zinc-600">Tên danh mục<input className="field" name="name" defaultValue={editing.name} required autoFocus/></label><label className="grid gap-1 text-sm text-zinc-600">Slug<input className="field" name="slug" defaultValue={editing.slug} required/></label><button className="btn btn-primary" disabled={busy}><Save size={16}/>Lưu thay đổi</button></form></Modal>}
  </main></AdminShell>;
}

export function AdminProductsManager() {
  const [items, setItems] = useState<CatalogProduct[]>([]); const [categories, setCategories] = useState<Category[]>([]); const [query, setQuery] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState(false); const [busy, setBusy] = useState(false); const [creating, setCreating] = useState(false); const [editing, setEditing] = useState<CatalogProduct | null>(null);
  async function refresh() { setItems(await api<CatalogProduct[]>(`/admin/products${query ? `?q=${encodeURIComponent(query)}` : ""}`)); }
  async function refreshCategories() { setCategories(await api<Category[]>("/admin/categories")); }
  useEffect(() => { void Promise.all([refresh(), refreshCategories()]).catch((e) => { setMessage(e.message); setError(true); }); }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setMessage(""); setError(false);
    try {
      const categoryId = String(form.get("categoryId") ?? "");
      const productType = String(form.get("productType"));
      const legacyType = productType === "LINH_KIEN" ? "COMPONENT" : editing?.type === "IOT_MINI" ? "IOT_MINI" : "IOT_PRO";
      const payload = { slug: String(form.get("slug")).trim(), name: String(form.get("name")).trim(), type: legacyType, product_type: productType, category_id: categoryId || null, price_sell: Number(form.get("priceSell")), price_rent_month: Number(form.get("priceRentMonth")), deposit_fee: Number(form.get("depositFee")), stock: Number(form.get("stock")), images: String(form.get("image") ?? "").trim() ? [String(form.get("image")).trim()] : [], specs: editing?.specs ?? {} };
      await api(editing ? `/admin/products/${editing.id}` : "/admin/products", { method: editing ? "PATCH" : "POST", body: JSON.stringify(payload) });
      invalidateAdminDataCache(); await refresh(); setCreating(false); setEditing(null); setMessage(editing ? "Đã cập nhật sản phẩm." : "Đã tạo sản phẩm.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Không lưu được sản phẩm."); setError(true); }
    finally { setBusy(false); }
  }
  async function remove(item: CatalogProduct) { if (!window.confirm(`Xóa sản phẩm ${item.name}?`)) return; setBusy(true); setMessage(""); setError(false); try { await api(`/admin/products/${item.id}`, { method: "DELETE" }); invalidateAdminDataCache(); await refresh(); setMessage("Đã xóa sản phẩm."); } catch (e) { setMessage(e instanceof Error ? e.message : "Không xóa được sản phẩm đã có giao dịch."); setError(true); } finally { setBusy(false); } }
  return <AdminShell><main className="space-y-6"><header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-zinc-500">Admin workspace</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Tất cả sản phẩm</h1><p className="mt-2 text-sm text-zinc-500">Tạo và quản lý sản phẩm, thiết bị và linh kiện.</p></div><div className="flex flex-col gap-2 sm:flex-row"><input className="field bg-white sm:w-56" placeholder="Tìm sản phẩm..." value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void refresh(); } }}/><button className="btn btn-primary" onClick={() => { setError(false); setCreating(true); }}><Plus size={16}/>Thêm sản phẩm</button></div></header><Notice value={message} error={error}/>
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr><th className="px-5 py-3">SKU</th><th className="px-5 py-3">Tên</th><th className="px-5 py-3">Loại / tồn</th><th className="px-5 py-3">Giá</th><th className="px-5 py-3">Thao tác</th></tr></thead><tbody className="divide-y divide-zinc-100">{items.map((item) => <tr key={item.id} className="hover:bg-zinc-50"><td className="px-5 py-4 font-medium">{item.sku ?? item.id}</td><td className="px-5 py-4">{item.name}</td><td className="px-5 py-4">{item.productType ?? item.type} · {item.stock}</td><td className="px-5 py-4">{new Intl.NumberFormat("vi-VN").format(item.priceSell)} ₫</td><td className="px-5 py-4"><div className="flex gap-2"><button className="btn btn-secondary min-h-9 text-xs" onClick={() => { setError(false); setEditing(item); }}><Pencil size={14}/>Sửa</button><button className="btn btn-secondary min-h-9 text-xs text-red-700" disabled={busy} onClick={() => void remove(item)}><Trash2 size={14}/>Xóa</button></div></td></tr>)}</tbody></table>{!items.length && <p className="p-8 text-center text-sm text-zinc-500">Không có sản phẩm.</p>}</div>
    {(creating || editing) && <Modal title={editing ? "Sửa sản phẩm" : "Thêm sản phẩm"} onClose={() => { setCreating(false); setEditing(null); }}><form key={editing?.id ?? "new-product"} onSubmit={(event) => void save(event)} className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-1 text-sm text-zinc-600">Tên sản phẩm<input className="field" name="name" defaultValue={editing?.name ?? ""} required autoFocus/></label><label className="grid gap-1 text-sm text-zinc-600">Slug<input className="field" name="slug" defaultValue={editing?.slug ?? ""} required/></label>
      <label className="grid gap-1 text-sm text-zinc-600">Loại sản phẩm<select className="field" name="productType" defaultValue={editing?.productType ?? (editing?.type === "COMPONENT" ? "LINH_KIEN" : "THIET_BI_BAN")}><option value="LINH_KIEN">Linh kiện</option><option value="THIET_BI_BAN">Sản phẩm</option><option value="THIET_BI_THUE">Cho thuê</option></select></label><label className="grid gap-1 text-sm text-zinc-600">Danh mục<select className="field" name="categoryId" defaultValue={editing?.categoryId ?? editing?.category?.id ?? ""}><option value="">Chưa phân danh mục</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{!categories.length && <span className="text-xs text-zinc-500">Chưa có danh mục. Hãy tạo danh mục trước.</span>}</label><label className="grid gap-1 text-sm text-zinc-600">Tồn kho<input className="field" name="stock" type="number" min="0" defaultValue={editing?.stock ?? 0} required/></label>
      <label className="grid gap-1 text-sm text-zinc-600">Giá bán<input className="field" name="priceSell" type="number" min="0" defaultValue={editing?.priceSell ?? 0} required/></label><label className="grid gap-1 text-sm text-zinc-600">Giá thuê / tháng<input className="field" name="priceRentMonth" type="number" min="0" defaultValue={editing?.priceRentMonth ?? 0} required/></label>
      <label className="grid gap-1 text-sm text-zinc-600">Tiền cọc<input className="field" name="depositFee" type="number" min="0" defaultValue={editing?.depositFee ?? 0} required/></label><label className="grid gap-1 text-sm text-zinc-600">URL ảnh<input className="field" name="image" defaultValue={editing?.images?.[0] ?? ""} placeholder="https://..."/></label>
      <button className="btn btn-primary sm:col-span-2" disabled={busy}><Save size={16}/>{busy ? "Đang lưu…" : "Lưu sản phẩm"}</button>
    </form></Modal>}
  </main></AdminShell>;
}
