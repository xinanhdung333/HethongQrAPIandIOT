import type { ReactNode } from "react";

export function AuthBackground({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex flex-1 items-center overflow-hidden px-4 py-12 sm:px-6 lg:py-16">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(228,228,231,0.65),transparent_38%),linear-gradient(to_bottom,#fafafa,#f4f4f5)]" />
      <div className="relative z-10 mx-auto w-full">{children}</div>
    </main>
  );
}
