import { RequireLogin } from "@/components/require-login";
import { Footer } from "@/components/footer";
import { DashboardNav } from "./dashboard-nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireLogin>
      <main className="dashboard-theme min-h-screen bg-zinc-50">
        <DashboardNav />
        <section className="dashboard-content min-w-0 px-4 py-5 md:px-6 lg:ml-64">
          <div className="mx-auto max-w-7xl">{children}</div>
        </section>
        <div className="dashboard-content lg:ml-64">
          <Footer />
        </div>
      </main>
    </RequireLogin>
  );
}
