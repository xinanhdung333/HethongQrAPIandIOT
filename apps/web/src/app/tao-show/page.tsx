import { Reveal } from "@/components/reveal";
import { RequireLogin } from "@/components/require-login";
import { ShowForm } from "./show-form";

export default function CreateShowPage() {
  return (
    <RequireLogin>
      <main className="shell py-16 md:py-24">
      <Reveal>
        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">Tạo show white-label</h1>
        <p className="mt-4 max-w-2xl text-zinc-600">Nhập thông tin show, banner, màu chủ đạo, giá vé và STK demo để có link /e/[slug].</p>
      </Reveal>
      <div className="mt-10">
        <ShowForm />
      </div>
      <Reveal className="mt-14 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="panel p-6">
          <h2 className="text-2xl font-semibold tracking-tight">Trang bán vé riêng</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600">Mỗi show có URL công khai, banner riêng, màu chủ đạo riêng và form mua vé PayOS demo.</p>
        </section>
        <section className="panel p-6">
          <h2 className="text-2xl font-semibold tracking-tight">Nhúng vào Facebook</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600">Sau khi tạo show, hệ thống trả iframe để bạn dán vào landing, bài đăng hoặc trang giới thiệu sự kiện.</p>
        </section>
      </Reveal>
      </main>
    </RequireLogin>
  );
}
