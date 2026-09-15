import { Suspense } from "react";
import { PaymentClient } from "./payment-client";

export default function DemoPaymentPage() {
  return (
    <Suspense fallback={<main className="shell py-16">Đang tải thanh toán demo...</main>}>
      <PaymentClient />
    </Suspense>
  );
}
