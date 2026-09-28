"use client";

import { useEffect, useState } from "react";
import { CreditCard, Loader2, ShoppingBag } from "lucide-react";
import { api, money, Product } from "@/lib/api";

type CheckoutResult = { order_id: string; payment_demo_url: string; total: number };

export function ComponentShop({ products }: { products: Product[] }) {
  const [items, setItems] = useState(products);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [address, setAddress] = useState("12 Nguyễn Huệ, Quận 1, TP.HCM");
  const [loadingId, setLoadingId] = useState("");
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<Product[]>("/products", { cache: "no-store" }).then((result) => {
      if (!result) return;
      setItems(result.filter((product) => product.type === "COMPONENT"));
    });
  }, []);

  async function buy(product: Product) {
    setLoadingId(product.id);
    setError("");
    try {
      const quantity = quantities[product.id] ?? 1;
      const checkout = await api<CheckoutResult>(`/products/${product.id}/buy`, {
        method: "POST",
        body: JSON.stringify({
          quantity,
          shipping_address: { address, note: "Giao hàng demo Phase 1" }
        })
      });
      if (!checkout) return;
      setResult(checkout);
      window.open(checkout.payment_demo_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo đơn mua demo");
    } finally {
      setLoadingId("");
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((product) => (
          <article key={product.id} className="panel p-6">
            <ShoppingBag className="text-zinc-900" />
            <h2 className="mt-5 text-xl font-semibold tracking-tight">{product.name}</h2>
            <p className="mt-2 text-sm text-zinc-600">Tồn kho {product.stock}. Có hóa đơn demo và hỗ trợ lắp đặt.</p>
            <div className="mt-5 grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <b>{money(product.priceSell)}</b>
                <input
                  aria-label={`Số lượng ${product.name}`}
                  className="field h-10 w-24"
                  min={1}
                  max={product.stock}
                  type="number"
                  value={quantities[product.id] ?? 1}
                  onChange={(event) => setQuantities((items) => ({ ...items, [product.id]: Number(event.target.value) || 1 }))}
                />
              </div>
              <button className="btn btn-primary text-sm" disabled={loadingId === product.id} onClick={() => buy(product)}>
                {loadingId === product.id ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                Mua demo
              </button>
            </div>
          </article>
        ))}
      </div>
      <aside className="panel h-fit p-6">
        <h2 className="text-xl font-semibold tracking-tight">Thanh toán linh kiện</h2>
        <label className="mt-5 grid gap-2 text-sm font-medium">
          Địa chỉ nhận hàng
          <textarea className="field min-h-24" value={address} onChange={(event) => setAddress(event.target.value)} />
        </label>
        {result && (
          <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">
            <b>Đơn {result.order_id}</b>
            <p className="mt-1 text-zinc-600">Tổng {money(result.total)}. PayOS mock sẽ tự paid sau 5 giây.</p>
            <a className="btn btn-secondary mt-4 text-sm" href={result.payment_demo_url} target="_blank" rel="noreferrer">
              Mở thanh toán
            </a>
          </div>
        )}
        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </aside>
    </div>
  );
}
