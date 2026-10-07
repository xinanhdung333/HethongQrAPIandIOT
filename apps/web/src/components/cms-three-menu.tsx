"use client";

import Link from "next/link";
import { ArrowRight, Layers3 } from "lucide-react";
import type { StaticPage } from "@/lib/api";

export function CmsThreeMenu({ pages }: { pages: StaticPage[] }) {
  const visiblePages = pages
    .filter((page) => page.published)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .slice(0, 6);

  if (!visiblePages.length) return null;

  return (
    <div className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm md:grid-cols-[0.9fr_1.4fr] md:p-5">
      <div className="flex items-start gap-3 border-b border-zinc-200 pb-4 md:border-b-0 md:border-r md:pb-0 md:pr-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-zinc-950 text-white">
          <Layers3 size={18} />
        </span>
        <div>
          <p className="text-sm font-medium text-zinc-500">CMS pages</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-950">Noi dung dang xuat ban</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Cac trang public duoc sap xep theo thu tu hien thi trong CMS.</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {visiblePages.map((page) => (
          <Link
            key={page.id}
            href={`/${page.slug}`}
            className="group flex min-h-20 items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm transition duration-200 hover:border-zinc-300 hover:bg-white"
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold text-zinc-950">{page.navLabel || page.title}</span>
              <span className="mt-1 line-clamp-1 block text-xs text-zinc-500">{page.description}</span>
            </span>
            <ArrowRight size={15} className="shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-zinc-900" />
          </Link>
        ))}
      </div>
    </div>
  );
}
