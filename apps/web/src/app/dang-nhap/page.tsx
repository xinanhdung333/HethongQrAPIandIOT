import { Suspense } from "react";
import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { AuthBackground } from "@/components/auth-background";
import { AuthClient } from "./auth-client";

export const metadata: Metadata = {
  title: "Đăng nhập | SmartQR Platform",
  description: "Đăng nhập vào hệ sinh thái SmartQR để quản lý thiết bị, sự kiện và API tokens."
};

function AuthSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-5xl animate-pulse overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm lg:grid-cols-[0.95fr_1.05fr]">
      <div className="hidden min-h-[660px] bg-zinc-950 p-10 lg:block">
        <div className="h-9 w-28 rounded-lg bg-zinc-800" />
        <div className="mx-auto my-20 h-56 w-56 rounded-xl bg-zinc-900" />
        <div className="h-6 w-3/4 rounded bg-zinc-800" />
      </div>
      <div className="flex flex-col justify-center p-8 sm:p-12">
        <div className="mb-8 h-10 w-full rounded-lg bg-zinc-100" />
        <div className="mb-6 space-y-2">
          <div className="h-4 w-24 rounded bg-zinc-100" />
          <div className="h-8 w-48 rounded bg-zinc-200" />
        </div>
        <div className="space-y-4">
          <div className="h-11 rounded-lg bg-zinc-100" />
          <div className="h-11 rounded-lg bg-zinc-100" />
          <div className="h-11 rounded-lg bg-zinc-900" />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <Header />
      <AuthBackground>
        <Suspense fallback={<AuthSkeleton />}>
          <AuthClient mode="login" />
        </Suspense>
      </AuthBackground>
      <Footer />
    </div>
  );
}
