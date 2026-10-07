import Link from "next/link";
import { AdminShell } from "../admin-resource-page";
export default function AdminComponentsPage() { return <AdminShell><main className="mx-auto max-w-3xl space-y-4 py-8"><p className="text-sm font-medium text-zinc-500">Admin workspace</p><h1 className="text-3xl font-semibold tracking-tight">Quản lý linh kiện</h1><p className="text-zinc-600">Bảng riêng cho linh kiện và mô tả cấu hình bên trong.</p><Link className="btn btn-primary mt-2 inline-flex" href="/admin/linh-kien/ton-kho">Mở bảng linh kiện</Link></main></AdminShell>; }
