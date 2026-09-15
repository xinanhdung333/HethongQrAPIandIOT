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
      <dl className="mt-5 grid gap-2 text-sm">
        <div className="flex justify-between"><dt>Giá bán</dt><dd className="font-medium">{money(product.priceSell)}</dd></div>
        {product.priceRentMonth > 0 && <div className="flex justify-between"><dt>Giá thuê/tháng</dt><dd className="font-medium">{money(product.priceRentMonth)}</dd></div>}
        {product.depositFee > 0 && <div className="flex justify-between"><dt>Cọc</dt><dd className="font-medium">{money(product.depositFee)}</dd></div>}
      </dl>
      <div className="mt-6 flex gap-3">
        {product.type !== "COMPONENT" && <Link href={`/thue-thiet-bi?product=${product.id}`} className="btn btn-primary flex-1 text-sm">Thuê</Link>}
        <Link href={product.type === "COMPONENT" ? "/linh-kien" : "/san-pham"} className="btn btn-secondary flex-1 text-sm">
          <ShoppingCart size={16} />
          Mua
        </Link>
      </div>
    </article>
  );
}
