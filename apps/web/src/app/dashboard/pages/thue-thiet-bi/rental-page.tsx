import { Suspense } from "react";
import { Reveal } from "@/components/reveal";
import { RequireLogin } from "@/components/require-login";
import { api, Product } from "@/lib/api";
import { RentalForm } from "./rental-form";

export const dynamic = "force-dynamic";

export default async function RentalPage() {
  const products = (await api<Product[]>("/products").catch(() => [])).filter((product) => product.type !== "COMPONENT");
  return (
    <RequireLogin>
      <main className="shell py-16 md:py-24">
      <Reveal>
        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">Thuê API + Hộp</h1>
        <p className="mt-4 max-w-2xl text-zinc-600">Chọn sản phẩm, số lượng, thời gian và địa chỉ lắp đặt. PayOS demo sẽ tự paid sau 5 giây.</p>
      </Reveal>
      <div className="mt-10">
        <Suspense fallback={<div className="panel p-6">Đang tải form...</div>}>
          <RentalForm products={products} />
        </Suspense>
      </div>
      <Reveal className="mt-14 grid gap-6 md:grid-cols-3">
        {[
          ["Lắp đặt", "Kỹ thuật viên cấu hình Wi-Fi, gate ID và API Key tại địa chỉ của bạn."],
          ["Vận hành", "Thiết bị gọi API verify, dashboard nhận realtime khi quét vé hợp lệ."],
          ["Hoàn trả", "Cuối kỳ thuê kiểm tra tình trạng hộp, đầu quét và phụ kiện đi kèm."]
        ].map(([title, desc]) => (
          <article key={title} className="panel p-6">
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">{desc}</p>
          </article>
        ))}
      </Reveal>
      </main>
    </RequireLogin>
  );
}
