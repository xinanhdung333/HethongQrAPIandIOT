"use client";

import { CreditCard, Smartphone } from "lucide-react";

export type PaymentMethod = "payos_demo" | "momo";

const methods: Array<{
  value: PaymentMethod;
  label: string;
  description: string;
  icon: typeof CreditCard;
}> = [
  { value: "payos_demo", label: "PayOS demo", description: "Thanh toán mô phỏng", icon: CreditCard },
  { value: "momo", label: "MoMo sandbox", description: "Tao payUrl bang HMAC MoMo", icon: Smartphone }
];

export function PaymentMethodSelect({ value, onChange }: { value: PaymentMethod | null; onChange: (value: PaymentMethod) => void }) {
  return (
    <div className="grid gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Phuong thuc thanh toan</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {methods.map((method) => {
          const Icon = method.icon;
          const active = value === method.value;
          return (
            <button
              key={method.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(method.value)}
              className={`flex min-h-20 items-start gap-3 rounded-lg border p-3 text-left transition duration-200 hover:border-zinc-400 ${
                active ? "border-zinc-900 bg-zinc-950 text-white" : "border-zinc-200 bg-white text-zinc-900"
              }`}
            >
              <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${active ? "bg-white/10" : "bg-zinc-100"}`}>
                <Icon size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{method.label}</span>
                <span className={`mt-1 block text-xs leading-5 ${active ? "text-zinc-300" : "text-zinc-500"}`}>{method.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
