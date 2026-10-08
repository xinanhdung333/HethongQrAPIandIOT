import Link from "next/link";
import { Box, ShoppingCart } from "lucide-react";
import { Product, money } from "@/lib/api";

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="panel flex h-full flex-col p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900">
        <Box />
      </div>
      <h3 className="mt-5 text-xl font-semibold tracking-tight">{product.name}</h3>
      <p className="mt-2 text-sm text-zinc-600">Tồn kho {product.stock}. Bảo hành và hỗ trợ lắp đặt demo.</p>
      {product.specs && (Object.keys(product.specs).length > 0) && <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600"><p className="font-medium text-zinc-900">Mô tả / linh kiện</p><p className="mt-1">{String(product.specs.description ?? "")}</p>{Array.isArray(product.specs.components) && <p className="mt-1">{(product.specs.components as unknown[]).map(String).join(" · ")}</p>}</div>}
      <dl className="mt-5 grid gap-2 text-sm">
        <div className="flex justify-between"><dt>Giá bán</dt><dd className="font-medium">{money(product.priceSell)}</dd></div>
        {product.priceRentMonth > 0 && <div className="flex justify-between"><dt>Giá thuê/tháng</dt><dd className="font-medium">{money(product.priceRentMonth)}</dd></div>}
      </dl>
      <div className="mt-6 flex gap-3">
        {product.type !== "COMPONENT" && product.productType !== "THIET_BI_BAN" && product.productType !== "LINH_KIEN" && product.priceRentMonth > 0 && <Link href={`/dashboard/pages/thue-thiet-bi/thanh-toan?product=${product.id}`} className="btn btn-primary flex-1 text-sm">Thuê</Link>}
        <Link href={product.type === "COMPONENT" ? "/linh-kien" : "/san-pham"} className="btn btn-secondary flex-1 text-sm">
          <ShoppingCart size={16} />
          Mua
        </Link>
      </div>
    </article>
  );
}
