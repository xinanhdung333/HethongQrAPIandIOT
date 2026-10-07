"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, PackageOpen, Search, ShoppingBag, Wrench } from "lucide-react";
import { api, money, Product } from "@/lib/api";

export function ComponentShop({ products }: { products: Product[] }) {
  const [items, setItems] = useState(products);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void api<Product[]>("/products", { cache: "no-store" })
      .then((result) => setItems(result.filter((item) => item.productType === "LINH_KIEN")))
      .catch(() => undefined);
  }, []);

  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("vi");
    return items.filter((item) => !value || `${item.name} ${item.slug}`.toLocaleLowerCase("vi").includes(value));
  }, [items, query]);

  return (
    <>
      <section className="panel overflow-hidden">
        <div className="border-b border-zinc-200 bg-gradient-to-r from-violet-50/60 via-white to-emerald-50/40 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-semibold">Danh mục linh kiện</h2><p className="mt-1 text-sm text-zinc-500">Xem thông tin, giá và tồn kho trước khi mua.</p></div>
            <label className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} /><input className="field !pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm linh kiện..." /></label>
          </div>
        </div>

        {filtered.length ? (
          <div className="grid gap-4 p-4 sm:grid-cols-2 md:p-5 lg:grid-cols-3">
            {filtered.map((product) => (
              <motion.article initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} key={product.id} className="flex min-w-0 flex-col rounded-xl border border-zinc-200 bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-sm">
                <div className="aspect-[4/3] overflow-hidden rounded-lg bg-zinc-100">
                  {product.images?.[0] ? <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-zinc-500"><Wrench size={28} /></div>}
                </div>
                <div className="mt-4 flex-1"><h3 className="truncate font-semibold">{product.name}</h3><p className="mt-1 truncate text-xs text-zinc-500">{product.slug}</p></div>
                <div className="mt-4 flex items-end justify-between gap-3 border-t border-zinc-100 pt-3"><b>{money(product.priceSell)}</b><span className={`text-xs font-medium ${product.stock ? "text-emerald-700" : "text-red-600"}`}>{product.stock ? `Còn ${product.stock}` : "Hết hàng"}</span></div>
                <Link href={`/dashboard/pages/linh-kien/thanh-toan?product=${encodeURIComponent(product.id)}`} aria-disabled={!product.stock} className={`btn mt-4 w-full text-sm ${product.stock ? "btn-primary" : "pointer-events-none bg-zinc-200 text-zinc-500"}`}><ShoppingBag size={16} />Mua ngay<ArrowRight size={15} /></Link>
              </motion.article>
            ))}
          </div>
        ) : <Empty hasItems={items.length > 0} />}
      </section>

      <section className="panel mt-6 overflow-hidden"><div className="border-b border-zinc-200 p-5"><h2 className="font-semibold">Bộ kit SP-01 Mini gợi ý</h2><p className="mt-1 text-sm text-zinc-500">Danh sách vật tư tham khảo cho đội kỹ thuật tự lắp ráp.</p></div><div className="grid gap-3 p-4 sm:grid-cols-2 md:p-5 lg:grid-cols-4">{[["Đầu quét","GM65 / 2D barcode scanner","emerald"],["Điều khiển","ESP32 DevKit + Wi-Fi","violet"],["Cơ khí","Servo, vỏ hộp và dây nối","amber"],["Đóng gói","Tem, QR test và biên bản","blue"]].map(([title, desc, tone], index) => <article key={title} className="rounded-xl border border-zinc-200 p-4"><span className={`grid size-8 place-items-center rounded-lg text-xs font-semibold ${tone === "emerald" ? "bg-emerald-50 text-emerald-700" : tone === "violet" ? "bg-violet-50 text-violet-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>0{index + 1}</span><h3 className="mt-3 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-zinc-500">{desc}</p></article>)}</div></section>
    </>
  );
}

function Empty({ hasItems }: { hasItems: boolean }) {
  return <div className="grid min-h-80 place-items-center p-8 text-center"><div><div className="mx-auto grid size-12 place-items-center rounded-xl bg-zinc-100 text-zinc-500"><PackageOpen size={22} /></div><h3 className="mt-4 font-semibold">{hasItems ? "Không tìm thấy linh kiện" : "Chưa có dữ liệu linh kiện"}</h3><p className="mt-2 text-sm text-zinc-500">{hasItems ? "Thử một từ khóa khác." : "Linh kiện sẽ xuất hiện khi được thêm từ trang quản trị."}</p></div></div>;
}
