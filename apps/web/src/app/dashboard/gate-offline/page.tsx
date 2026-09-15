import { RequireLogin } from "@/components/require-login";
import { GateOfflineClient } from "./gate-offline-client";

export default function Page() {
  return (
    <RequireLogin>
      <main className="shell py-10">
        <GateOfflineClient />
      </main>
    </RequireLogin>
  );
}
