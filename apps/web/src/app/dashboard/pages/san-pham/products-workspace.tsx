"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpDown, Box, Check, Grid2X2, List, PackageOpen, Search, ShoppingCart, SlidersHorizontal, Truck, X } from "lucide-react";
import { money, Product } from "@/lib/api";

type Availability = "all" | "available" | "rentable";
type Sort = "featured" | "price-asc" | "price-desc" | "stock-desc";

export function ProductsWorkspace({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState<Availability>("all");
  const [sort, setSort] = useState<Sort>("featured");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [selected, setSelected] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi");
    return products
      .filter((product) => !normalized || `${product.name} ${product.slug}`.toLocaleLowerCase("vi").includes(normalized))
      .filter((product) => availability === "all" || (availability === "available" ? product.stock > 0 : product.priceRentMonth > 0))
      .sort((a, b) => sort === "price-asc" ? a.priceSell - b.priceSell : sort === "price-desc" ? b.priceSell - a.priceSell : sort === "stock-desc" ? b.stock - a.stock : a.name.localeCompare(b.name, "vi"));
  }, [availability, products, query, sort]);

  function toggleCompare(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current);
  }
  const compared = products.filter((product) => selected.includes(product.id));

  return <>
    <section className="panel overflow-hidden">
      <div className="border-b border-zinc-200 p-4 md:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <label className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="field !pl-10 !pr-10" placeholder="Tìm theo tên hoặc mã sản phẩm..." />
            {query && <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-900" aria-label="Xóa tìm kiếm"><X size={16} /></button>}
          </label>
          <div className="flex min-w-0 flex-wrap gap-2">
            <FilterSelect icon={<SlidersHorizontal size={15} />} value={availability} onChange={(value) => setAvailability(value as Availability)} options={[['all','Tất cả trạng thái'],['available','Còn hàng'],['rentable','Có thể thuê']]} />
            <FilterSelect icon={<ArrowUpDown size={15} />} value={sort} onChange={(value) => setSort(value as Sort)} options={[['featured','Tên A–Z'],['price-asc','Giá thấp trước'],['price-desc','Giá cao trước'],['stock-desc','Tồn kho nhiều']]} />
            <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
              <ViewButton active={view === "grid"} label="Dạng lưới" onClick={() => setView("grid")}><Grid2X2 size={16} /></ViewButton>
              <ViewButton active={view === "table"} label="Dạng bảng" onClick={() => setView("table")}><List size={17} /></ViewButton>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-zinc-500"><span>Hiển thị <b className="text-zinc-900">{filtered.length}</b>/{products.length} thiết bị</span><span className="hidden sm:block">Chọn tối đa 3 sản phẩm để so sánh</span></div>
      </div>

      {filtered.length === 0 ? <EmptyState hasProducts={products.length > 0} clear={() => { setQuery(""); setAvailability("all"); }} /> : view === "grid" ?
        <div className="grid gap-4 p-4 md:grid-cols-2 md:p-5 xl:grid-cols-3">{filtered.map((product) => <ProductTile key={product.id} product={product} selected={selected.includes(product.id)} onCompare={() => toggleCompare(product.id)} />)}</div> :
        <ProductTable products={filtered} selected={selected} onCompare={toggleCompare} />}
    </section>

    {compared.length > 0 && <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="panel mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-5"><div><h2 className="font-semibold">So sánh nhanh</h2><p className="mt-1 text-sm text-zinc-500">{compared.length}/3 sản phẩm đã chọn</p></div><button type="button" className="text-sm font-medium text-zinc-500 hover:text-zinc-950" onClick={() => setSelected([])}>Xóa lựa chọn</button></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><tbody className="divide-y divide-zinc-200"><CompareRow label="Sản phẩm" values={compared.map((item) => item.name)} strong /><CompareRow label="Giá bán" values={compared.map((item) => money(item.priceSell))} /><CompareRow label="Giá thuê/tháng" values={compared.map((item) => item.priceRentMonth ? money(item.priceRentMonth) : "Không hỗ trợ")} /><CompareRow label="Tiền cọc" values={compared.map((item) => money(item.depositFee))} /><CompareRow label="Tồn kho" values={compared.map((item) => `${item.stock} thiết bị`)} /></tbody></table></div>
    </motion.section>}
  </>;
}

function ProductTile({ product, selected, onCompare }: { product: Product; selected: boolean; onCompare: () => void }) {
  return <motion.article initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35 }} className="group flex min-w-0 flex-col rounded-xl border border-zinc-200 bg-white p-5 transition duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-sm">
    <div className="flex items-start justify-between gap-3"><div className="grid size-11 place-items-center overflow-hidden rounded-lg bg-zinc-100 text-zinc-700">{product.images?.[0] ? <img src={product.images[0]} alt={product.name} className="size-full object-cover" /> : <Box size={20} />}</div><button type="button" onClick={onCompare} className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition ${selected ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 text-zinc-600 hover:border-zinc-400"}`}>{selected && <Check size={13} />}{selected ? "Đã chọn" : "So sánh"}</button></div>
    <div className="mt-4 flex items-center gap-2"><span className={`size-2 rounded-full ${product.stock > 0 ? "bg-emerald-500" : "bg-zinc-300"}`} /><span className="text-xs font-medium text-zinc-500">{product.stock > 0 ? `Còn ${product.stock} thiết bị` : "Tạm hết hàng"}</span></div>
    <h2 className="mt-2 truncate text-lg font-semibold tracking-tight text-zinc-950">{product.name}</h2><p className="mt-1 text-xs text-zinc-500">Mã: {product.slug}</p>
    <div className="mt-5 grid gap-2 border-y border-zinc-100 py-4 text-sm"><Price label="Giá bán" value={money(product.priceSell)} strong /><Price label="Thuê/tháng" value={product.priceRentMonth ? money(product.priceRentMonth) : "Không hỗ trợ"} /><Price label="Tiền cọc" value={money(product.depositFee)} /></div>
    <div className="mt-5 grid grid-cols-2 gap-2"><Link href={`/dashboard/pages/thue-thiet-bi/thanh-toan?product=${product.id}`} className="btn btn-primary min-w-0 text-sm"><Truck size={15} /> Thuê ngay</Link><Link href={`/dashboard/pages/san-pham/thanh-toan?product=${product.id}`} className="btn btn-secondary min-w-0 bg-white text-sm"><ShoppingCart size={15} /> Mua</Link></div>
  </motion.article>;
}

function ProductTable({ products, selected, onCompare }: { products: Product[]; selected: string[]; onCompare: (id: string) => void }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500"><tr>{["Sản phẩm","Trạng thái","Giá bán","Giá thuê","Cọc","Thao tác"].map((item) => <th key={item} className="px-5 py-3 font-medium">{item}</th>)}</tr></thead><tbody className="divide-y divide-zinc-200">{products.map((product) => <tr key={product.id} className="transition hover:bg-zinc-50"><td className="px-5 py-4"><b>{product.name}</b><span className="mt-1 block text-xs text-zinc-500">{product.slug}</span></td><td className="px-5 py-4"><span className="inline-flex items-center gap-2"><span className={`size-2 rounded-full ${product.stock ? "bg-emerald-500" : "bg-zinc-300"}`} />{product.stock} thiết bị</span></td><td className="px-5 py-4 font-medium">{money(product.priceSell)}</td><td className="px-5 py-4">{product.priceRentMonth ? money(product.priceRentMonth) : "—"}</td><td className="px-5 py-4">{money(product.depositFee)}</td><td className="px-5 py-4"><div className="flex gap-2"><button type="button" onClick={() => onCompare(product.id)} className={`h-9 rounded-lg border px-3 text-xs font-medium ${selected.includes(product.id) ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200"}`}>So sánh</button><Link href={`/dashboard/pages/thue-thiet-bi/thanh-toan?product=${product.id}`} className="btn btn-primary h-9 text-xs">Thuê</Link><Link href={`/dashboard/pages/san-pham/thanh-toan?product=${product.id}`} className="btn btn-secondary h-9 text-xs">Mua</Link></div></td></tr>)}</tbody></table></div>;
}

function FilterSelect({ icon, value, onChange, options }: { icon: ReactNode; value: string; onChange: (value: string) => void; options: string[][] }) { return <div className="relative flex-1 sm:flex-none"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">{icon}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="field min-w-[150px] appearance-none bg-white !pl-9 !pr-8 text-sm">{options.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></div>; }
function EmptyState({ hasProducts, clear }: { hasProducts: boolean; clear: () => void }) { return <div className="grid min-h-[360px] place-items-center p-8 text-center"><div><div className="mx-auto grid size-12 place-items-center rounded-xl bg-zinc-100 text-zinc-500"><PackageOpen size={22} /></div><h2 className="mt-4 font-semibold text-zinc-950">{hasProducts ? "Không tìm thấy sản phẩm" : "Chưa có dữ liệu sản phẩm"}</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">{hasProducts ? "Thử thay đổi từ khóa hoặc bộ lọc để xem thêm kết quả." : "Dữ liệu sẽ xuất hiện khi dịch vụ sản phẩm hoạt động hoặc quản trị viên thêm thiết bị."}</p>{hasProducts && <button type="button" onClick={clear} className="btn btn-secondary mt-5 bg-white text-sm">Xóa bộ lọc</button>}</div></div>; }
function ViewButton({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: ReactNode }) { return <button type="button" onClick={onClick} title={label} aria-label={label} className={`grid size-9 place-items-center rounded-md transition ${active ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-400 hover:text-zinc-700"}`}>{children}</button>; }
function Price({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className="flex items-center justify-between gap-3"><span className="text-zinc-500">{label}</span><span className={strong ? "font-semibold text-zinc-950" : "font-medium text-zinc-700"}>{value}</span></div>; }
function CompareRow({ label, values, strong = false }: { label: string; values: string[]; strong?: boolean }) { return <tr><th className="w-40 bg-zinc-50 px-5 py-3 text-left text-xs font-medium text-zinc-500">{label}</th>{values.map((value, index) => <td key={`${value}-${index}`} className={`px-5 py-3 ${strong ? "font-semibold" : "text-zinc-700"}`}>{value}</td>)}</tr>; }
