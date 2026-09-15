import { Suspense } from "react";
import { AuthClient } from "../dang-nhap/auth-client";

export default function RegisterPage() {
  return (
    <main className="shell py-16 md:py-24">
      <Suspense fallback={<div className="panel mx-auto max-w-md p-6">Đang tải...</div>}>
        <AuthClient mode="register" />
      </Suspense>
    </main>
  );
}
