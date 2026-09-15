import { AdminConsole } from "./admin-console";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-zinc-50">
      <AdminConsole />
    </main>
  );
}
