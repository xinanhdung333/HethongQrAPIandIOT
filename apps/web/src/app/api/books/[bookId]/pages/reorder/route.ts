import { NextResponse } from "next/server";
import { readBookPages, writeBookPages } from "@/lib/books";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: { bookId: string } }) {
  try {
    const body = await request.json() as { orderedIds?: string[] };
    if (!Array.isArray(body.orderedIds)) {
      return NextResponse.json({ error: "orderedIds is required" }, { status: 400 });
    }

    const pages = await readBookPages();
    const bookPages = pages.filter((page) => page.bookId === params.bookId);
    const existingIds = new Set(bookPages.map((page) => page.id));
    const validIds = body.orderedIds.filter((id) => existingIds.has(id));
    const missingIds = bookPages.map((page) => page.id).filter((id) => !validIds.includes(id));
    const orderedIds = [...validIds, ...missingIds];

    const next = pages.map((page) => {
      if (page.bookId !== params.bookId) return page;
      const index = orderedIds.indexOf(page.id);
      return { ...page, pageNumber: index + 1 };
    });

    await writeBookPages(next);
    return NextResponse.json({ pages: next.filter((page) => page.bookId === params.bookId).sort((a, b) => a.pageNumber - b.pageNumber) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Cannot reorder pages" }, { status: 400 });
  }
}
