import { NextResponse } from "next/server";
import { assertUniquePageNumber, normalizePageNumber, readBookPages, writeBookPages } from "@/lib/books";
import { saveBookImage } from "@/lib/book-upload";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: { bookId: string; pageId: string } }) {
  try {
    const form = await request.formData();
    const pageNumber = normalizePageNumber(form.get("pageNumber"));
    const pages = await readBookPages();
    const index = pages.findIndex((page) => page.bookId === params.bookId && page.id === params.pageId);
    if (index < 0) return NextResponse.json({ error: "Page not found" }, { status: 404 });

    assertUniquePageNumber(pages, params.bookId, pageNumber, params.pageId);
    const image = form.get("image");
    const imageUrl = image instanceof File && image.size > 0 ? await saveBookImage(image, params.bookId) : pages[index].imageUrl;

    const updated = {
      ...pages[index],
      pageNumber,
      imageUrl,
      title: String(form.get("title") ?? "").trim() || undefined,
      content: String(form.get("content") ?? "").trim() || undefined
    };
    pages[index] = updated;
    await writeBookPages(pages);
    return NextResponse.json({ page: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Cannot update page" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { bookId: string; pageId: string } }) {
  const pages = await readBookPages();
  const next = pages.filter((page) => !(page.bookId === params.bookId && page.id === params.pageId));
  if (next.length === pages.length) return NextResponse.json({ error: "Page not found" }, { status: 404 });
  await writeBookPages(next);
  return NextResponse.json({ ok: true });
}
