import { BookPagesAdmin } from "./book-pages-admin";

export const dynamic = "force-dynamic";

export default function AdminBookPagesPage({ params }: { params: { bookId: string } }) {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 md:px-6">
      <BookPagesAdmin bookId={params.bookId} />
    </main>
  );
}
