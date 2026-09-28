import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type BookPage = {
  id: string;
  bookId: string;
  pageNumber: number;
  imageUrl: string;
  title?: string;
  content?: string;
  createdAt: string;
};

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "book-pages.json");

async function ensureDataFile() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeFile(dataFile, "[]", "utf8");
  }
}

export async function readBookPages(): Promise<BookPage[]> {
  await ensureDataFile();
  const raw = await readFile(dataFile, "utf8");
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export async function writeBookPages(pages: BookPage[]) {
  await ensureDataFile();
  await writeFile(dataFile, `${JSON.stringify(pages, null, 2)}\n`, "utf8");
}

export async function getBookPages(bookId: string) {
  const pages = await readBookPages();
  return pages
    .filter((page) => page.bookId === bookId)
    .sort((a, b) => a.pageNumber - b.pageNumber || a.createdAt.localeCompare(b.createdAt));
}

export function normalizePageNumber(value: FormDataEntryValue | null) {
  const pageNumber = Number(value);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new Error("pageNumber must be a positive integer");
  }
  return pageNumber;
}

export function assertUniquePageNumber(pages: BookPage[], bookId: string, pageNumber: number, ignoreId?: string) {
  const duplicated = pages.some((page) => page.bookId === bookId && page.pageNumber === pageNumber && page.id !== ignoreId);
  if (duplicated) {
    throw new Error("pageNumber already exists in this book");
  }
}
