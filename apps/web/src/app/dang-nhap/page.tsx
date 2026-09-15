import { Suspense } from "react";
import { AuthClient } from "./auth-client";

export default function LoginPage() {
  return (
    <main className="shell py-16 md:py-24">
      <Suspense fallback={<div className="panel mx-auto max-w-md p-6">Đang tải...</div>}>
        <AuthClient mode="login" />
      </Suspense>
    </main>
  );
}
