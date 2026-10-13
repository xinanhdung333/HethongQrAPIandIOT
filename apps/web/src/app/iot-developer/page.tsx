import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { IotDeveloperClient } from "../dashboard/iot-developer/iot-developer-client";

export const metadata = {
  title: "Quét thử IoT Developer | SmartQR",
  description: "Công cụ công khai để kiểm tra quét QR và đồng bộ thiết bị IoT SmartQR."
};

export default function Page() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <Header />
      <main className="mx-auto min-w-0 max-w-[1200px] px-4 py-8 md:py-12">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-medium text-zinc-500">SmartQR Public Tools</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">Quét thử IoT Developer</h1>
          <p className="mt-3 text-zinc-600">Kiểm tra QR, public key và đồng bộ sự kiện thiết bị mà không cần đăng nhập dashboard.</p>
        </div>
        <IotDeveloperClient />
      </main>
      <Footer />
    </div>
  );
}
