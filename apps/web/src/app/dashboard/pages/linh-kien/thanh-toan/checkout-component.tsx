"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Truck,
  UserRound
} from "lucide-react";
import { api, money, Product } from "@/lib/api";
import { PaymentMethod, PaymentMethodSelect } from "@/components/payment-method-select";

type CheckoutResult = { order_id: string; payment_demo_url: string; total: number };
type MeResult = {
  user: {
    addressLine?: string | null;
    wardName?: string | null;
    districtName?: string | null;
    provinceName?: string | null;
    phone?: string | null;
    fullName?: string | null;
  };
};

type CheckoutComponentProps = {
  productId: string;
  productKind?: "component" | "device";
  backHref?: string;
};

export function CheckoutComponent({
  productId,
  productKind = "component",
  backHref = "/dashboard/pages/linh-kien"
}: CheckoutComponentProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("payos_demo");

  useEffect(() => {
    void Promise.all([
      api<Product[]>("/products", { cache: "no-store" }),
      api<MeResult>("/auth/me", { cache: "no-store" }).catch(() => null)
    ])
      .then(([products, me]) => {
        const expectedType = productKind === "component" ? "COMPONENT" : "DEVICE";
        setProduct(
          products.find((item) => {
            const isExpectedKind = expectedType === "COMPONENT" ? item.type === "COMPONENT" : item.type !== "COMPONENT";
            return item.id === productId && isExpectedKind;
          }) ?? null
        );

        if (me?.user) {
          setReceiverName(me.user.fullName ?? "");
          setReceiverPhone(me.user.phone ?? "");
          setAddress([me.user.addressLine, me.user.wardName, me.user.districtName, me.user.provinceName].filter(Boolean).join(", "));
        }
      })
      .catch(() => setError("Khong the tai thong tin san pham."))
      .finally(() => setPageLoading(false));
  }, [productId, productKind]);

  const maxQuantity = Math.max(product?.stock ?? 0, 0);
  const safeQuantity = maxQuantity > 0 ? Math.min(quantity, maxQuantity) : 0;
  const total = useMemo(() => (product?.priceSell ?? 0) * safeQuantity, [product, safeQuantity]);
  const hasAddress = Boolean(receiverName.trim() && receiverPhone.trim() && address.trim());
  const selectedMethodLabel = paymentMethod === "momo" ? "MoMo sandbox" : "PayOS demo";

  async function buy() {
    if (!product || !hasAddress || safeQuantity < 1) return;
    setLoading(true);
    setError("");
    try {
      const checkout = await api<CheckoutResult>(`/products/${product.id}/buy`, {
        method: "POST",
        body: JSON.stringify({
          quantity: safeQuantity,
          shipping_address: {
            full_name: receiverName.trim(),
            phone: receiverPhone.trim(),
            address: address.trim(),
            note: note.trim() || "Don hang SmartQR"
          },
          payment_method: paymentMethod
        })
      });
      setResult(checkout);
      window.location.href = checkout.payment_demo_url;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Khong the tao don mua.");
    } finally {
      setLoading(false);
    }
  }

  if (pageLoading) {
    return (
      <div className="grid min-h-96 place-items-center">
        <Loader2 className="animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!product) {
    return (
      <main className="mx-auto max-w-2xl py-10">
        <section className="panel p-8 text-center">
          <h1 className="text-xl font-semibold">Khong tim thay san pham</h1>
          <p className="mt-2 text-sm text-zinc-500">San pham co the da bi xoa hoac duong dan khong hop le.</p>
          <Link href={backHref} className="btn btn-primary mt-5">
            <ArrowLeft size={16} />
            Ve danh muc
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-w-0 max-w-[1180px] py-3 md:py-5">
      <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-950">
        <ArrowLeft size={16} />
        Quay lai danh muc
      </Link>

      <div className="mt-5 flex flex-col gap-4 border-b border-zinc-200 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">SmartQR Checkout</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
            Thanh toan {productKind === "component" ? "linh kien" : "san pham"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            Chon dia chi nhan hang, kiem tra san pham va phuong thuc thanh toan tren mot trang rieng.
          </p>
        </div>
        <div className="flex rounded-lg border border-zinc-200 bg-white p-1 text-xs font-medium text-zinc-600">
          <span className="rounded-md bg-zinc-950 px-3 py-2 text-white">Dia chi</span>
          <span className="px-3 py-2">San pham</span>
          <span className="px-3 py-2">Thanh toan</span>
        </div>
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4">
          <section className="panel overflow-hidden">
            <SectionHeader icon={MapPin} title="Dia chi nhan hang" description="Thong tin nay se duoc luu vao don hang." />
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                Ho ten nguoi nhan
                <input className="field" value={receiverName} onChange={(event) => setReceiverName(event.target.value)} placeholder="Nguyen Van A" />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                So dien thoai
                <input className="field" value={receiverPhone} onChange={(event) => setReceiverPhone(event.target.value)} placeholder="0900000000" />
              </label>
              <label className="grid gap-2 text-sm font-medium md:col-span-2">
                Dia chi cu the
                <textarea
                  className="field min-h-24"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="So nha, duong, phuong/xa, quan/huyen, tinh/thanh"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium md:col-span-2">
                Ghi chu giao hang
                <input className="field" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Vi du: giao gio hanh chinh" />
              </label>
              <div className="md:col-span-2">
                <Link href="/dashboard/profile" className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600 hover:text-zinc-950">
                  <UserRound size={14} />
                  Cap nhat dia chi mac dinh trong ho so
                </Link>
              </div>
            </div>
          </section>

          <section className="panel overflow-hidden">
            <SectionHeader icon={ShoppingBag} title="San pham dat mua" description="Kiem tra so luong va ton kho truoc khi thanh toan." />
            <div className="grid gap-5 p-5 md:grid-cols-[160px_1fr_auto] md:items-center">
              <div className="aspect-[4/3] overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
                {product.images?.[0] ? <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight">{product.name}</h2>
                <p className="mt-1 text-sm text-zinc-500">{product.slug}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1">Con {product.stock} san pham</span>
                  <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1">Don gia {money(product.priceSell)}</span>
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-zinc-500">So luong</p>
                <div className="flex h-11 w-40 items-center justify-between rounded-lg border border-zinc-200 px-2">
                  <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="grid size-8 place-items-center rounded-md hover:bg-zinc-100" aria-label="Giam so luong">
                    <Minus size={15} />
                  </button>
                  <b>{safeQuantity}</b>
                  <button type="button" onClick={() => setQuantity((value) => Math.min(maxQuantity || 1, value + 1))} className="grid size-8 place-items-center rounded-md hover:bg-zinc-100" aria-label="Tang so luong">
                    <Plus size={15} />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="panel overflow-hidden">
            <SectionHeader icon={CreditCard} title="Phuong thuc thanh toan" description="Chon cong thanh toan truoc khi tao don." />
            <div className="p-5">
              <PaymentMethodSelect value={paymentMethod} onChange={setPaymentMethod} />
            </div>
          </section>
        </div>

        <aside className="grid gap-4 lg:sticky lg:top-20">
          <section className="panel overflow-hidden">
            <div className="border-b border-zinc-200 p-5">
              <h2 className="font-semibold">Tong thanh toan</h2>
              <p className="mt-1 text-sm text-zinc-500">Tom tat don hang cua ban.</p>
            </div>
            <div className="grid gap-4 p-5 text-sm">
              <SummaryLine label="Tam tinh" value={money(total)} />
              <SummaryLine label="Phi giao/lap dat" value="Lien he" />
              <SummaryLine label="Phuong thuc" value={selectedMethodLabel} />
              <div className="flex items-end justify-between gap-3 border-t border-zinc-200 pt-4">
                <span className="font-medium">Can thanh toan</span>
                <b className="text-xl tracking-tight text-zinc-950">{money(total)}</b>
              </div>

              <div className={`rounded-lg border p-3 ${hasAddress ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/70"}`}>
                <p className="flex items-center gap-2 font-medium">
                  {hasAddress ? <CheckCircle2 size={15} className="text-emerald-600" /> : <MapPin size={15} className="text-amber-600" />}
                  {hasAddress ? "Dia chi da san sang" : "Can nhap day du dia chi"}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-600">{hasAddress ? `${receiverName} - ${receiverPhone} - ${address}` : "Nhap ten, so dien thoai va dia chi de tiep tuc."}</p>
              </div>

              {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</p>}
              {result && (
                <p className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 size={16} />
                  Da tao don {result.order_id}
                </p>
              )}

              <button
                type="button"
                disabled={!product.stock || !hasAddress || safeQuantity < 1 || loading}
                onClick={() => void buy()}
                className="btn btn-primary w-full disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                {loading ? "Dang tao don..." : "Dat hang va thanh toan"}
              </button>

              <p className="flex gap-2 text-xs leading-5 text-zinc-500">
                <ShieldCheck size={14} className="mt-0.5 shrink-0" />
                Don chi duoc kich hoat sau khi cong thanh toan xac nhan thanh cong.
              </p>
            </div>
          </section>

          <section className="panel p-5">
            <div className="flex items-center gap-2">
              <Truck size={17} className="text-zinc-700" />
              <h2 className="font-semibold">Quy trinh don hang</h2>
            </div>
            <div className="mt-4 grid gap-3 text-xs leading-5 text-zinc-600">
              <ProcessItem text="Tao don va chuyen sang cong thanh toan." />
              <ProcessItem text="Xac nhan thanh toan qua PayOS demo hoac MoMo sandbox." />
              <ProcessItem text="SmartQR xu ly giao hang/lap dat sau khi don duoc paid." />
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

function SectionHeader({ icon: Icon, title, description }: { icon: typeof MapPin; title: string; description: string }) {
  return (
    <div className="border-b border-zinc-200 bg-zinc-50/80 p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-white text-zinc-800 shadow-sm ring-1 ring-zinc-200">
          <Icon size={18} />
        </span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
        </div>
      </div>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-zinc-500">{label}</span>
      <b className="text-right font-medium">{value}</b>
    </div>
  );
}

function ProcessItem({ text }: { text: string }) {
  return (
    <p className="flex gap-2">
      <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-zinc-950 text-white">
        <Check size={10} />
      </span>
      {text}
    </p>
  );
}
