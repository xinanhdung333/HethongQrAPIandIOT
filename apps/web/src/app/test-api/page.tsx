import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ApiTestWorkbench } from "./test-workbench";

export const metadata = {
  title: "Test API và quét vé | SmartQR",
  description: "Công cụ công khai để thử tạo QR bằng API thuê và xác minh vé SmartQR."
};

export default function ApiTestPage() {
  return (
    <>
      <Header />
      <main className="shell min-h-[calc(100vh-4rem)] py-12 md:py-20">
        <ApiTestWorkbench />
      </main>
      <Footer />
    </>
  );
}
