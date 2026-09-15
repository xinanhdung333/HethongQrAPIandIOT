"use client";

import Link from "next/link";
import { Cpu, Github, Mail, MapPin, Phone } from "lucide-react";

const groups = [
  {
    title: "Sản phẩm",
    links: [
      ["SP-01 Mini", "/san-pham"],
      ["Thuê thiết bị", "/thue-thiet-bi"],
      ["Tạo show", "/tao-show"],
      ["Linh kiện", "/linh-kien"]
    ]
  },
  {
    title: "Nền tảng",
    links: [
      ["Bảng giá", "/bang-gia"],
      ["Tài liệu API", "/docs"],
      ["Dashboard", "/dashboard"],
      ["Quét thử", "/dashboard/scan"]
    ]
  }
];

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-zinc-950 text-zinc-100">
      <div className="shell grid gap-10 py-14 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-zinc-950">
              <Cpu size={18} />
            </span>
            SmartQR
          </Link>
          <p className="mt-5 max-w-sm text-sm leading-6 text-zinc-400">
            Nền tảng QR thông minh cho thuê hộp quét, bán vé white-label và vận hành cổng soát vé realtime.
          </p>
          <div className="mt-6 grid gap-2 text-sm text-zinc-400">
            <span className="flex items-center gap-2"><MapPin size={15} /> TP.HCM, Việt Nam</span>
            <span className="flex items-center gap-2"><Phone size={15} /> 0900 000 000</span>
            <span className="flex items-center gap-2"><Mail size={15} /> hello@smartqr.vn</span>
          </div>
        </div>
        {groups.map((group) => (
          <div key={group.title}>
            <h3 className="font-semibold">{group.title}</h3>
            <div className="mt-4 grid gap-3 text-sm text-zinc-400">
              {group.links.map(([label, href]) => (
                <Link key={href} href={href} className="transition hover:text-white">
                  {label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-zinc-800">
        <div className="shell flex flex-wrap items-center justify-between gap-3 py-5 text-sm text-zinc-500">
          <span>© 2026 SmartQR Platform. Phase 1 demo.</span>
          <span className="inline-flex items-center gap-2"><Github size={15} /> Next.js 14 · NestJS · Prisma · Redis</span>
        </div>
      </div>
    </footer>
  );
}
