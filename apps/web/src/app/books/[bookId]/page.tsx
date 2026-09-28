export const dynamic = "force-dynamic";

export default function BookPage({ params }: { params: { bookId: string } }) {
  return (
    <main className="min-h-screen bg-[#ece7dc]">
      <iframe
        src={`/api/home-book?slug=${encodeURIComponent(params.bookId)}&nointro=1`}
        title={`Book ${params.bookId}`}
        className="block h-screen w-full border-0"
      />
    </main>
  );
}
