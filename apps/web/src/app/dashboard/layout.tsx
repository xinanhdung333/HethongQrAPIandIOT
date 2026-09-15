import { RequireLogin } from "@/components/require-login";
import { DashboardNav } from "./dashboard-nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireLogin>
      <main className="shell grid min-w-0 gap-8 py-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="panel h-fit p-3">
          <DashboardNav />
        </aside>
        <section className="min-w-0">{children}</section>
      </main>
    </RequireLogin>
  );
}
