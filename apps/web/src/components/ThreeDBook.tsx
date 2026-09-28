"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import "@designcodeio/threeui/style.css";
import type { BookPage } from "@/lib/books";

type ThreeDBookProps = { pages: BookPage[]; assetBaseUrl?: string };

export function ThreeDBook({ pages, assetBaseUrl = "/threeui-assets" }: ThreeDBookProps) {
  const [active, setActive] = useState(0);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") setActive((value) => Math.max(0, value - 2));
      if (event.key === "ArrowRight") setActive((value) => Math.min(Math.max(0, pages.length - 2), value + 2));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pages.length]);

  if (!pages.length) return <div className="grid min-h-[420px] place-items-center border border-[#d8d0c1] bg-[#f5f0e7] text-sm text-[#766f64]">Chưa có trang sách.</div>;

  const leftPage = pages[active];
  const rightPage = pages[active + 1];
  const canPrevious = active > 0;
  const canNext = active + 2 < pages.length;
  const move = (direction: -1 | 1) => setActive((value) => Math.min(Math.max(0, value + direction * 2), Math.max(0, pages.length - 2)));

  return (
    <section className="threeui-reader relative overflow-hidden bg-[#eee8dc] text-[#4a453e]" style={{ backgroundImage: `url(${assetBaseUrl}/sketchbook/bg-wash.jpg)` }}>
      <Image src={`${assetBaseUrl}/sketchbook/botany-left.png`} alt="" aria-hidden fill className="pointer-events-none absolute left-0 top-0 z-0 h-auto w-[30%] object-contain object-left-top opacity-35" sizes="30vw" />
      <Image src={`${assetBaseUrl}/sketchbook/botany-right.png`} alt="" aria-hidden fill className="pointer-events-none absolute right-0 top-0 z-0 h-auto w-[26%] object-contain object-right-top opacity-25" sizes="26vw" />
      <div className="relative mx-auto flex min-h-[min(760px,calc(100vh-140px))] max-w-[1280px] flex-col px-4 pb-12 pt-8 sm:px-8 lg:px-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center gap-2 border-b border-[#bcb3a4]/60 pb-4 font-serif text-xs uppercase tracking-[0.28em] text-[#81796e]"><span className="text-[10px] tracking-[0.32em] text-[#938a7d]">SmartQR / Designer / Creator / QR Platform</span><span>{String(leftPage?.pageNumber ?? 1).padStart(2, "0")} — {String(rightPage?.pageNumber ?? leftPage?.pageNumber ?? 1).padStart(2, "0")}</span></div>
        <div className="relative mx-auto flex w-full max-w-5xl flex-1 items-center justify-center py-10 sm:py-16">
          <button type="button" aria-label="Trang trước" disabled={!canPrevious} onClick={() => move(-1)} className="reader-arrow left-0 sm:left-2">‹</button>
          <div className="book-spread relative grid w-full max-w-[940px] grid-cols-1 shadow-[0_24px_55px_rgba(74,61,42,0.22)] sm:grid-cols-2">
            <ReaderPage page={leftPage} side="left" imageError={Boolean(leftPage && imageErrors[leftPage.id])} onImageError={() => leftPage && setImageErrors((value) => ({ ...value, [leftPage.id]: true }))} />
            {rightPage ? <ReaderPage page={rightPage} side="right" imageError={Boolean(imageErrors[rightPage.id])} onImageError={() => setImageErrors((value) => ({ ...value, [rightPage.id]: true }))} /> : <div className="hidden bg-[#f9f6ef] sm:block" />}
            <div className="book-gutter" aria-hidden="true" />
          </div>
          <button type="button" aria-label="Trang sau" disabled={!canNext} onClick={() => move(1)} className="reader-arrow right-0 sm:right-2">›</button>
        </div>
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between border-t border-[#bcb3a4]/60 pt-4 text-xs uppercase tracking-[0.2em] text-[#81796e]"><span>{active + 1} / {pages.length}</span><span className="hidden sm:inline">Swipe or use arrow keys</span><span>{canNext ? "Next spread" : "End"}</span></div>
      </div>
    </section>
  );
}

function ReaderPage({ page, side, imageError, onImageError }: { page?: BookPage; side: "left" | "right"; imageError: boolean; onImageError: () => void }) {
  if (!page) return <div className="min-h-[430px] bg-[#f9f6ef]" />;
  return <article className={`reader-page relative min-h-[430px] overflow-hidden bg-[#f9f6ef] sm:min-h-[560px] ${side === "left" ? "sm:border-r-0" : "sm:border-l-0"}`}>
    {imageError ? <div className="absolute inset-0 grid place-items-center bg-[#e5ded0] p-8 text-center font-serif text-sm text-[#766f64]">Không thể tải ảnh trang này.</div> : <Image src={page.imageUrl || "/threeui-assets/sketchbook/bg-wash.jpg"} alt={page.title || `Trang ${page.pageNumber}`} fill sizes="(max-width: 640px) 92vw, 46vw" className="object-cover" onError={onImageError} />}
    {(page.title || page.content) ? <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#221f1b]/85 via-[#221f1b]/45 to-transparent px-6 pb-7 pt-20 text-white sm:px-9"><p className="mb-2 font-serif text-[10px] uppercase tracking-[0.28em] text-white/70">Trang {page.pageNumber}</p>{page.title ? <h2 className="font-serif text-2xl leading-tight sm:text-3xl">{page.title}</h2> : null}{page.content ? <p className="mt-3 line-clamp-4 max-w-md font-serif text-sm leading-6 text-white/85">{page.content}</p> : null}</div> : null}
  </article>;
}
