import { CheckoutComponent } from "../../linh-kien/thanh-toan/checkout-component";

export default function ProductCheckoutPage({ searchParams }: { searchParams: { product?: string } }) {
  return <CheckoutComponent productId={searchParams.product ?? ""} productKind="device" backHref="/dashboard/pages/san-pham" />;
}
