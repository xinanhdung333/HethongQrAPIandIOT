import Link from "next/link";
import { AdminShell } from "../admin-resource-page";
export default function AdminProductsPage() { return <AdminShell><main className="mx-auto max-w-3xl space-y-4 py-8"><p className="text-sm font-medium text-zinc-500">Admin workspace</p><h1 className="text-3xl font-semibold tracking-tight">Quản lý sản phẩm bán</h1><p className="text-zinc-600">Bảng riêng cho sản phẩm, giá bán và tồn kho.</p><Link className="btn btn-primary mt-2 inline-flex" href="/admin/products">Mở bảng sản phẩm</Link></main></AdminShell>; }
