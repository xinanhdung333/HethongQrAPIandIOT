"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Banknote, BarChart3, ChevronDown, FileClock, FileText, KeyRound, Radio, ScanLine, Settings, ShieldCheck, Ticket, Truck, UserRound, Webhook, WifiOff } from "lucide-react";

const nav = [
  ["Tổng quan", "/dashboard", Activity],
  ["Đơn thuê", "/dashboard/rentals", Truck],
  ["Show", "/dashboard/shows", Radio],
  ["API Keys", "/dashboard/api-keys", KeyRound],
  ["Giao dịch", "/dashboard/payments", Banknote],
  ["Payout", "/dashboard/settings/payout", Settings],
  ["Vé đã mua", "/dashboard/tickets", Ticket],
  ["Tài liệu", "/dashboard/documents", FileText],
  ["Quét thử", "/dashboard/scan", ScanLine],
  ["Demo cong offline", "/dashboard/gate-offline", WifiOff],
  ["Cá nhân", "/dashboard/profile", UserRound]
] as const;

const apiKeyChildren = [
  ["keys", "Danh sach key", "/dashboard/api-keys#keys", KeyRound],
  ["secrets", "Rental secrets", "/dashboard/api-keys#secrets", ShieldCheck],
  ["analytics", "Analytics", "/dashboard/api-keys#analytics", BarChart3],
  ["webhooks", "Webhook", "/dashboard/api-keys#webhooks", Webhook],
  ["audit", "Audit logs", "/dashboard/api-keys#audit", FileClock]
] as const;

export function DashboardNav() {
  const [apiOpen, setApiOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setApiOpen(window.location.pathname.startsWith("/dashboard/api-keys"));
  }, []);

  function selectApiSection(sectionId: string, href: string) {
    if (pathname.startsWith("/dashboard/api-keys")) {
      window.history.replaceState(null, "", `#${sectionId}`);
      window.dispatchEvent(new CustomEvent("smartqr:api-section", { detail: sectionId }));
      return;
    }

    router.push(href);
  }

  return (
    <nav className="grid gap-1">
      {nav.map(([label, href, Icon]) => {
        if (href === "/dashboard/api-keys") {
          return (
            <div key={href}>
              <button
                type="button"
                className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
                onClick={() => setApiOpen((value) => !value)}
              >
                <Icon size={16} />
                <span className="flex-1">{label}</span>
                <ChevronDown size={15} className={`transition-transform duration-200 ${apiOpen ? "rotate-180" : ""}`} />
              </button>
              <div className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out ${apiOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                <div className="min-h-0">
                  <div className="ml-4 mt-1 grid gap-1 border-l border-zinc-200 pl-2">
                    {apiKeyChildren.map(([sectionId, childLabel, childHref, ChildIcon]) => (
                      <button
                        key={childHref}
                        type="button"
                        className="flex min-h-8 items-center gap-2 rounded-lg px-2 text-left text-xs text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
                        onClick={() => selectApiSection(sectionId, childHref)}
                      >
                        <ChildIcon size={14} />
                        {childLabel}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        }

        return (
          <Link key={href} href={href} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950">
            <Icon size={16} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
