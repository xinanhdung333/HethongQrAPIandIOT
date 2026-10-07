import Link from "next/link";
import { AdminShell } from "../admin-resource-page";
export default function AdminDevicesPage() { return <AdminShell><main className="mx-auto max-w-3xl space-y-4 py-8"><p className="text-sm font-medium text-zinc-500">Admin workspace</p><h1 className="text-3xl font-semibold tracking-tight">Quản lý thiết bị cho thuê</h1><p className="text-zinc-600">Bảng riêng cho thiết bị quét, giá thuê theo tháng, tiền cọc và tồn kho.</p><Link className="btn btn-primary mt-2 inline-flex" href="/admin/products">Mở bảng thiết bị</Link></main></AdminShell>; }
