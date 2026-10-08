"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AdminShell } from "../../admin-resource-page";
import { invalidateAdminDataCache } from "../../admin-console";
import { Save } from "lucide-react";

type ProductForm = { id: string; slug: string; name: string; type: "IOT_MINI" | "IOT_PRO" | "COMPONENT"; priceSell: number; priceRentMonth: number; stock: number; images?: string[]; specs?: Record<string, unknown> };
const blank: Omit<ProductForm, "id"> = { slug: "", name: "", type: "COMPONENT", priceSell: 0, priceRentMonth: 0, stock: 0, images: [], specs: {} };

export default function AdminProductFormPage() {
  const { id } = useParams<{ id: string }>(); const router = useRouter(); const isNew = id === "new";
  const [values, setValues] = useState<Omit<ProductForm, "id">>(blank); const [loading, setLoading] = useState(!isNew); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  useEffect(() => { if (isNew) return; void api<ProductForm>(`/admin/products/${id}`).then((item) => setValues({ ...item, images: item.images ?? [], specs: item.specs ?? {} })).catch((error) => setMessage(error instanceof Error ? error.message : "Không tải được sản phẩm.")).finally(() => setLoading(false)); }, [id, isNew]);
  function field<K extends keyof typeof blank>(key: K, value: (typeof blank)[K]) { setValues((current) => ({ ...current, [key]: value })); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const form = new FormData(event.currentTarget);
      const payload = { slug: String(form.get("slug")).trim(), name: String(form.get("name")).trim(), type: values.type, price_sell: Number(form.get("priceSell")), price_rent_month: Number(form.get("priceRentMonth")), stock: Number(form.get("stock")), images: String(form.get("image") ?? "").trim() ? [String(form.get("image")).trim()] : [], specs: values.specs ?? {} };
      await api(isNew ? "/admin/products" : `/admin/products/${id}`, { method: isNew ? "POST" : "PATCH", body: JSON.stringify(payload) });
      invalidateAdminDataCache(); router.push("/admin/products"); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không lưu được sản phẩm."); }
    finally { setBusy(false); }
  }
  return <AdminShell><main className="mx-auto max-w-3xl space-y-6"><header><p className="text-sm font-medium text-zinc-500">Admin workspace / Sản phẩm</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{isNew ? "Thêm sản phẩm" : "Sửa sản phẩm"}</h1></header>{loading ? <div className="panel p-6 text-sm text-zinc-500">Đang tải sản phẩm…</div> : <form onSubmit={(event) => void save(event)} className="panel grid gap-4 p-5 sm:grid-cols-2">
    <label className="grid gap-1 text-sm text-zinc-600">Tên sản phẩm<input className="field" name="name" value={values.name} onChange={(e) => field("name", e.target.value)} required/></label>
    <label className="grid gap-1 text-sm text-zinc-600">Slug<input className="field" name="slug" value={values.slug} onChange={(e) => field("slug", e.target.value)} required/></label>
    <label className="grid gap-1 text-sm text-zinc-600">Loại sản phẩm<select className="field" value={values.type} onChange={(e) => field("type", e.target.value as ProductForm["type"])}><option value="COMPONENT">Linh kiện</option><option value="IOT_MINI">Thiết bị IOT Mini</option><option value="IOT_PRO">Thiết bị IOT Pro</option></select></label>
    <label className="grid gap-1 text-sm text-zinc-600">Tồn kho<input className="field" name="stock" type="number" min="0" value={values.stock} onChange={(e) => field("stock", Number(e.target.value))} required/></label>
    <label className="grid gap-1 text-sm text-zinc-600">Giá bán<input className="field" name="priceSell" type="number" min="0" value={values.priceSell} onChange={(e) => field("priceSell", Number(e.target.value))} required/></label>
    <label className="grid gap-1 text-sm text-zinc-600">Giá thuê / tháng<input className="field" name="priceRentMonth" type="number" min="0" value={values.priceRentMonth} onChange={(e) => field("priceRentMonth", Number(e.target.value))} required/></label>
    <label className="grid gap-1 text-sm text-zinc-600">URL ảnh<input className="field" name="image" defaultValue={values.images?.[0] ?? ""} placeholder="https://..."/></label>
    {message && <p className="sm:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</p>}
    <div className="flex gap-2 sm:col-span-2"><button disabled={busy} className="btn btn-primary"><Save size={16}/>{busy ? "Đang lưu…" : "Lưu sản phẩm"}</button><Link className="btn btn-secondary" href="/admin/products">Hủy</Link></div>
  </form>}</main></AdminShell>;
}
