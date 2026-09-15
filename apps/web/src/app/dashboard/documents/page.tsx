export default function DocumentsPage() {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Tài liệu</h1>
      <section className="panel mt-6 p-6">
        <p className="text-zinc-600">Phase 1 chưa bật RAG upload. Route này được chừa sẵn cho Phase 2 documents và chatbot white-label.</p>
      </section>
      <section className="panel mt-6 p-6">
        <h2 className="font-semibold">Kế hoạch Phase 2</h2>
        <div className="mt-4 grid gap-3 text-sm text-zinc-600">
          <p>Upload PDF nội quy show, chunk tài liệu và lưu theo collection riêng.</p>
          <p>Chatbot trả lời theo nguồn, không leak dữ liệu giữa các show.</p>
          <p>Streaming SSE để trải nghiệm giống chat realtime.</p>
        </div>
      </section>
    </div>
  );
}
