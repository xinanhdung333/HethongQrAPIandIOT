"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CreditCard } from "lucide-react";
import { api, money, Product } from "@/lib/api";

export function RentalForm({ products }: { products: Product[] }) {
  const search = useSearchParams();
  const [items, setItems] = useState(products);
  const [productId, setProductId] = useState(search.get("product") || products[0]?.id || "");
  const [quantity, setQuantity] = useState(1);
  const [duration, setDuration] = useState(1);
  const [address, setAddress] = useState("123 Nguyễn Huệ, Quận 1, TP.HCM");
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    void api<Product[]>("/products", { cache: "no-store" }).then((result) => {
      if (!result) return;
      const rentable = result.filter((product) => product.type !== "COMPONENT");
      setItems(rentable);
      setProductId((current) => current || rentable[0]?.id || "");
    });
  }, []);

  const product = items.find((item) => item.id === productId) || items[0];
  const breakdown = useMemo(() => {
    if (!product) return { rent: 0, deposit: 0, install: 300000, total: 0 };
    const rent = product.priceRentMonth * duration * quantity;
    const deposit = product.depositFee * quantity;
    const install = 300000;
    return { rent, deposit, install, total: rent + deposit + install };
  }, [product, duration, quantity]);

  async function submit() {
    if (!product) return;
    setLoading(true);
    try {
      const result = await api<{ payment_demo_url: string }>("/rentals", {
        method: "POST",
        body: JSON.stringify({
          product_id: product.id,
          type: "rent",
          duration,
          quantity,
          shipping_address: { address },
          agree_damage_terms: agree
        })
      });
      if (!result) return;
      window.location.href = result.payment_demo_url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="panel grid gap-5 p-6">
        <label className="grid gap-2 text-sm font-medium">Sản phẩm
          <select className="field" value={product?.id ?? ""} onChange={(event) => setProductId(event.target.value)}>
            {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">Số lượng
            <input className="field" type="number" min={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
          </label>
          <label className="grid gap-2 text-sm font-medium">Thời gian
            <select className="field" value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
              <option value={1}>1 tháng</option>
              <option value={3}>3 tháng</option>
              <option value={12}>12 tháng</option>
            </select>
          </label>
        </div>
        <label className="grid gap-2 text-sm font-medium">Địa chỉ lắp đặt
          <textarea className="field min-h-28" value={address} onChange={(event) => setAddress(event.target.value)} />
        </label>
        <label className="flex gap-3 text-sm text-zinc-700">
          <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} />
          Đồng ý điều khoản thiệt hại: mất đền 100%, hỏng đầu quét 1tr.
        </label>
      </section>
      <aside className="panel h-fit p-6">
        <h2 className="text-xl font-semibold tracking-tight">Chi tiết phí</h2>
        <div className="mt-5 grid gap-3 text-sm">
          <div className="flex justify-between"><span>Tiền thuê</span><b>{money(breakdown.rent)}</b></div>
          <div className="flex justify-between"><span>Cọc</span><b>{money(breakdown.deposit)}</b></div>
          <div className="flex justify-between"><span>Lắp đặt</span><b>{money(breakdown.install)}</b></div>
          <div className="border-t border-zinc-200 pt-3 flex justify-between text-base"><span>Tổng</span><b>{money(breakdown.total)}</b></div>
        </div>
        <button disabled={!product || !agree || loading} onClick={submit} className="btn btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:bg-zinc-300">
          <CreditCard size={16} />
          {loading ? "Đang tạo đơn" : "Đặt thuê demo"}
        </button>
      </aside>
    </div>
  );
}
