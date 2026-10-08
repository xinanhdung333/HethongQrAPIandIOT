import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function DashboardRentalPage() {
  redirect("/dashboard/pages/san-pham");
}
