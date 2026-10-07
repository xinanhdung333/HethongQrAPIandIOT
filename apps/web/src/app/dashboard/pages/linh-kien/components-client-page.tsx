"use client";

import { useEffect, useState } from "react";
import { Boxes, PackageCheck, ShoppingBag } from "lucide-react";
import { api, money, Product } from "@/lib/api";
import { ComponentShop } from "./component-shop";

export function ComponentsClientPage() {
  const [products, setProducts] = useState<Product[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { void api<Product[]>("/products", { cache: "no-store" }).then((items) => setProducts(items.filter((item) => item.productType === "LINH_KIEN"))).catch((reason) => setError(reason instanceof Error ? reason.message : "Không tải được linh kiện.")).finally(() => setLoading(false)); }, []);
  const stock = products.reduce((sum, product) => sum + product.stock, 0); const inventoryValue = products.reduce((sum, product) => sum + product.stock * product.priceSell, 0);
  return <main className="mx-auto min-w-0 max-w-[1200px] py-3 md:py-5"><div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-medium text-zinc-500">SmartQR Components</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">Linh kiện và kit lắp ráp</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">Chọn linh kiện thay thế hoặc tự lắp hộp quét SmartQR.</p></div><div className="grid grid-cols-3 gap-2 sm:gap-3 lg:w-[510px]"><Summary icon={Boxes} label="Mã linh kiện" value={String(products.length)} /><Summary icon={PackageCheck} label="Tồn kho" value={String(stock)} /><Summary icon={ShoppingBag} label="Giá trị kho" value={money(inventoryValue)} /></div></div>{loading ? <section className="panel p-8 text-center text-sm text-zinc-500">Đang tải linh kiện...</section> : error ? <section className="panel p-8 text-center text-sm text-red-700">{error}</section> : <ComponentShop products={products} />}</main>;
}
function Summary({ icon: Icon, label, value }: { icon: typeof Boxes; label: string; value: string }) { return <div className="panel min-w-0 p-3.5 sm:p-4"><div className="flex items-center gap-2 text-zinc-500"><Icon size={15} /><span className="truncate text-[10px] font-semibold uppercase tracking-wide sm:text-xs">{label}</span></div><p className="mt-2 truncate text-xl font-semibold tracking-tight text-zinc-950">{value}</p></div>; }
