import { Suspense } from "react";
import { api, Product } from "@/lib/api";
import { RentalForm } from "../rental-form";

export const dynamic = "force-dynamic";

export default async function RentalCheckoutPage() {
  const products = (await api<Product[]>("/products").catch(() => [])).filter((product) => product.type !== "COMPONENT" && product.productType !== "LINH_KIEN" && product.productType !== "THIET_BI_BAN" && product.priceRentMonth > 0);
  return (
    <main className="mx-auto min-w-0 max-w-[1200px] py-3 md:py-5">
      <div className="mb-6"><p className="text-sm font-medium text-zinc-500">SmartQR Rental Checkout</p><h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Cấu hình và thanh toán đơn thuê</h1><p className="mt-2 text-sm text-zinc-600">Chọn thời hạn, số lượng, địa điểm lắp đặt và kiểm tra tổng chi phí.</p></div>
      <Suspense fallback={<div className="panel min-h-96 animate-pulse bg-zinc-100" />}><RentalForm products={products} /></Suspense>
    </main>
  );
}
