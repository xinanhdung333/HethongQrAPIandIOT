import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/reveal";
import { api, Product } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = (await api<Product[]>("/products").catch(() => [])).filter((product) => product.type !== "COMPONENT");
  return (
    <main className="shell py-16 md:py-24">
      <Reveal>
        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">Sản phẩm</h1>
        <p className="mt-4 max-w-2xl text-zinc-600">SP-01 Mini và SP-02 Pro có giá bán, giá thuê, tiền cọc và nút mua/thuê rõ ràng.</p>
      </Reveal>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {products.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
      <Reveal className="mt-14 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="panel p-6">
          <h2 className="text-2xl font-semibold tracking-tight">So sánh nhanh</h2>
          <div className="mt-6 grid gap-4 text-sm">
            <div className="flex justify-between border-b border-zinc-200 pb-3"><span>SP-01 Mini</span><b>Gym nhỏ, lớp học, quầy check-in</b></div>
            <div className="flex justify-between border-b border-zinc-200 pb-3"><span>SP-02 Pro</span><b>Show lớn, nhiều cổng, vận hành liên tục</b></div>
            <div className="flex justify-between"><span>API verify</span><b>JWT jti + rate limit 10 req/s</b></div>
          </div>
        </section>
        <section className="panel p-6">
          <h2 className="text-2xl font-semibold tracking-tight">Trong hộp có gì?</h2>
          <div className="mt-6 grid gap-3 text-sm text-zinc-600">
            <p>Thiết bị quét QR đã cấu hình sẵn gate ID.</p>
            <p>API Key chỉ hiển thị một lần, hệ thống lưu hash SHA-256.</p>
            <p>Dashboard theo dõi số vé bán, số lượt quét và lịch sử cổng.</p>
          </div>
        </section>
      </Reveal>
    </main>
  );
}
