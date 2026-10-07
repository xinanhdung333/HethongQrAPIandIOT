import { Suspense } from "react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { AuthClient } from "../dang-nhap/auth-client";

export default function RegisterPage() {
  return (
    <>
      <Header />
      <main className="shell min-h-[calc(100vh-4rem)] py-16 md:py-24">
        <Suspense fallback={<div className="panel mx-auto max-w-md p-6">Dang tai...</div>}>
          <AuthClient mode="register" />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
