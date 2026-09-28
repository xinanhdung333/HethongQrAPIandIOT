import { NextResponse } from "next/server";
import { assertUniquePageNumber, getBookPages, normalizePageNumber, readBookPages, type BookPage, writeBookPages } from "@/lib/books";
import { saveBookImage } from "@/lib/book-upload";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { bookId: string } }) {
  const pages = await getBookPages(params.bookId);
  return NextResponse.json({ pages });
}

export async function POST(request: Request, { params }: { params: { bookId: string } }) {
  try {
    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File) || image.size === 0) {
      return NextResponse.json({ error: "Image is required" }, { status: 400 });
    }

    const pageNumber = normalizePageNumber(form.get("pageNumber"));
    const pages = await readBookPages();
    assertUniquePageNumber(pages, params.bookId, pageNumber);

    const imageUrl = await saveBookImage(image, params.bookId);
    const page: BookPage = {
      id: crypto.randomUUID(),
      bookId: params.bookId,
      pageNumber,
      imageUrl,
      title: String(form.get("title") ?? "").trim() || undefined,
      content: String(form.get("content") ?? "").trim() || undefined,
      createdAt: new Date().toISOString()
    };

    await writeBookPages([...pages, page]);
    return NextResponse.json({ page }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Cannot create page" }, { status: 400 });
  }
}
