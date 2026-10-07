"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock3, CreditCard, PackageCheck, Truck } from "lucide-react";
import { api, money, Product } from "@/lib/api";

export default function RentalPage() {
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    void api<Product[]>("/products", { cache: "no-store" })
      .then((result) => setProducts(result.filter((product) => product.productType === "THIET_BI_THUE")))
      .catch(() => setProducts([]));
  }, []);
  const rentalPrices = products.map((product) => product.priceRentMonth).filter((price) => price > 0);
  const minRent = rentalPrices.length ? Math.min(...rentalPrices) : 0;
  const totalStock = products.reduce((sum, product) => sum + product.stock, 0);

  return <main className="mx-auto min-w-0 max-w-[1200px] py-3 md:py-5">
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-sm font-medium text-zinc-500">SmartQR Rental</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">Thuê thiết bị</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">Chọn thiết bị, thời hạn và địa điểm lắp đặt. Chi phí được tính ngay trước khi tạo đơn.</p></div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:w-[510px]"><Summary icon={PackageCheck} label="Sẵn sàng" value={`${totalStock} máy`} tone="emerald" /><Summary icon={CreditCard} label="Từ" value={money(minRent)} compact tone="amber" /><Summary icon={Clock3} label="Lắp đặt" value="Trong 24h" compact tone="violet" /></div>
    </div>
    <section className="panel overflow-hidden">
      <div className="border-b border-zinc-200 bg-gradient-to-r from-emerald-50/60 via-white to-violet-50/40 p-5"><h2 className="font-semibold">Danh mục thiết bị cho thuê</h2><p className="mt-1 text-sm text-zinc-500">Xem giá thuê và tồn kho; cấu hình đơn được thực hiện ở bước tiếp theo.</p></div>
      {products.length ? <div className="grid gap-4 p-4 md:grid-cols-2 md:p-5 xl:grid-cols-3">{products.map((product) => <article key={product.id} className="flex flex-col rounded-xl border border-zinc-200 bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-sm"><div className="aspect-[4/3] overflow-hidden rounded-lg bg-zinc-100">{product.images?.[0] ? <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><Truck size={24} /></div>}</div><div className="mt-4 flex items-start justify-between gap-3"><div><h3 className="font-semibold">{product.name}</h3><p className="mt-1 text-xs text-zinc-500">{product.slug}</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${product.stock ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>{product.stock ? `${product.stock} máy` : "Hết hàng"}</span></div><div className="mt-4 grid gap-2 border-t border-zinc-100 pt-4 text-sm"><Line label="Thuê/tháng" value={money(product.priceRentMonth)} strong /><Line label="Tiền cọc" value={money(product.depositFee)} /></div><Link href={`/dashboard/pages/thue-thiet-bi/thanh-toan?product=${encodeURIComponent(product.id)}`} className={`btn mt-4 w-full text-sm ${product.stock ? "btn-primary" : "pointer-events-none bg-zinc-200 text-zinc-500"}`}><Truck size={15} />Cấu hình đơn thuê<ArrowRight size={15} /></Link></article>)}</div> : <div className="p-10 text-center text-sm text-zinc-500">Chưa có thiết bị cho thuê.</div>}
    </section>
  </main>;
}

function Summary({ icon: Icon, label, value, compact = false, tone }: { icon: typeof Truck; label: string; value: string; compact?: boolean; tone: "emerald" | "amber" | "violet" }) { const accent = tone === "emerald" ? "bg-emerald-50 text-emerald-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-violet-50 text-violet-700"; return <div className="panel min-w-0 p-3.5 sm:p-4"><div className="flex items-center gap-2 text-zinc-500"><span className={`grid size-7 shrink-0 place-items-center rounded-lg ${accent}`}><Icon size={14} /></span><span className="truncate text-[10px] font-semibold uppercase tracking-wide sm:text-xs">{label}</span></div><p className={`mt-2 truncate font-semibold tracking-tight text-zinc-950 ${compact ? "text-sm sm:text-base" : "text-xl"}`}>{value}</p></div>; }
function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className="flex justify-between gap-3"><span className="text-zinc-500">{label}</span><b className={strong ? "text-zinc-950" : "font-medium text-zinc-700"}>{value}</b></div>; }
