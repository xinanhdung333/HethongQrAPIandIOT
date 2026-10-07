import { CheckoutComponent } from "./checkout-component";

export default function ComponentCheckoutPage({ searchParams }: { searchParams: { product?: string } }) {
  return <CheckoutComponent productId={searchParams.product ?? ""} />;
}
