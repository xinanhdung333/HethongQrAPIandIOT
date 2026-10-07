import { Boxes, PackageCheck, ShoppingBag } from "lucide-react";
import { api, money, Product } from "@/lib/api";
import { ComponentShop } from "./component-shop";

export const dynamic = "force-dynamic";

export default async function ComponentsPage() {
  const products = (await api<Product[]>("/products").catch(() => [])).filter((product) => product.productType === "LINH_KIEN");
  const stock = products.reduce((sum, product) => sum + product.stock, 0);
  const inventoryValue = products.reduce((sum, product) => sum + product.stock * product.priceSell, 0);

  return <main className="mx-auto min-w-0 max-w-[1200px] py-3 md:py-5">
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-sm font-medium text-zinc-500">SmartQR Components</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">Linh kiện và kit lắp ráp</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">Chọn linh kiện thay thế hoặc tự lắp hộp quét SmartQR theo cấu hình gợi ý.</p></div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:w-[510px]"><Summary icon={Boxes} label="Mã linh kiện" value={String(products.length)} tone="violet" /><Summary icon={PackageCheck} label="Tồn kho" value={String(stock)} tone="emerald" /><Summary icon={ShoppingBag} label="Giá trị kho" value={money(inventoryValue)} tone="amber" compact /></div>
    </div>
    <ComponentShop products={products} />
  </main>;
}

function Summary({ icon: Icon, label, value, tone, compact = false }: { icon: typeof Boxes; label: string; value: string; tone: "violet" | "emerald" | "amber"; compact?: boolean }) { const color = tone === "violet" ? "bg-violet-50 text-violet-700" : tone === "emerald" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"; return <div className="panel min-w-0 p-3.5 sm:p-4"><div className="flex items-center gap-2 text-zinc-500"><span className={`grid size-7 shrink-0 place-items-center rounded-lg ${color}`}><Icon size={14} /></span><span className="truncate text-[10px] font-semibold uppercase tracking-wide sm:text-xs">{label}</span></div><p className={`mt-2 truncate font-semibold tracking-tight ${compact ? "text-sm sm:text-base" : "text-xl"}`}>{value}</p></div>; }
