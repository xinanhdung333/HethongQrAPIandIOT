import { Reveal } from "@/components/reveal";
import { RequireLogin } from "@/components/require-login";
import { api, money, Product } from "@/lib/api";
import { ComponentShop } from "./component-shop";

export const dynamic = "force-dynamic";

export default async function ComponentsPage() {
  const products = (await api<Product[]>("/products").catch(() => [])).filter((product) => product.type === "COMPONENT");
  return (
    <RequireLogin>
      <main className="shell py-16 md:py-24">
      <Reveal>
        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">Linh kiện</h1>
        <p className="mt-4 max-w-2xl text-zinc-600">Bán lẻ GM65, ESP32, Servo, Vỏ hộp và OLED cho đội lập trình IoT.</p>
      </Reveal>
      <div className="mt-10">
        <ComponentShop products={products} />
      </div>
      <Reveal className="mt-14 panel overflow-hidden p-0">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-zinc-950 p-8 text-zinc-100">
            <h2 className="text-3xl font-semibold tracking-tight">Bộ kit gợi ý</h2>
            <p className="mt-4 text-zinc-400">Một cấu hình cơ bản để dựng hộp quét QR SP-01 Mini cho demo tại quầy.</p>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            {["GM65 UART", "ESP32 DevKit", "OLED SSD1306", "Servo SG90"].map((item) => (
              <div key={item} className="rounded-lg border border-zinc-200 p-4 text-sm font-medium">{item}</div>
            ))}
          </div>
        </div>
      </Reveal>
      </main>
    </RequireLogin>
  );
}
