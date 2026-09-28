import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function saveBookImage(file: File, bookId: string) {
  if (!allowedTypes.has(file.type)) {
    throw new Error("Only JPEG, PNG, WEBP or AVIF images are allowed");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const uploadDir = path.join(process.cwd(), "public", "uploads", "books", bookId);
  await mkdir(uploadDir, { recursive: true });

  const filename = `${Date.now()}-${crypto.randomUUID()}.webp`;
  const target = path.join(uploadDir, filename);

  let quality = 82;
  let output = await sharp(bytes).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality }).toBuffer();
  while (output.byteLength > 500_000 && quality > 48) {
    quality -= 8;
    output = await sharp(bytes).rotate().resize({ width: 1400, withoutEnlargement: true }).webp({ quality }).toBuffer();
  }

  await writeFile(target, output);
  return `/uploads/books/${bookId}/${filename}`;
}
