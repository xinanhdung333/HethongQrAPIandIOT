"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ImagePlus, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import type { BookPage } from "@/lib/books";

type FormState = {
  id?: string;
  pageNumber: string;
  title: string;
  content: string;
  file: File | null;
  preview: string;
};

const emptyForm: FormState = { pageNumber: "1", title: "", content: "", file: null, preview: "" };

export function BookPagesAdmin({ bookId }: { bookId: string }) {
  const [pages, setPages] = useState<BookPage[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    void loadPages();
  }, [bookId]);

  const sortedPages = useMemo(() => [...pages].sort((a, b) => a.pageNumber - b.pageNumber), [pages]);

  async function loadPages() {
    setLoading(true);
    const response = await fetch(`/api/books/${bookId}/pages`, { cache: "no-store" });
    const data = await response.json() as { pages: BookPage[] };
    setPages(data.pages ?? []);
    setForm((current) => ({ ...current, pageNumber: String((data.pages?.length ?? 0) + 1) }));
    setLoading(false);
  }

  function chooseFile(file: File | null) {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setForm((current) => ({ ...current, file, preview }));
  }

  function editPage(page: BookPage) {
    setForm({
      id: page.id,
      pageNumber: String(page.pageNumber),
      title: page.title ?? "",
      content: page.content ?? "",
      file: null,
      preview: page.imageUrl
    });
    setMessage("");
  }

  function resetForm() {
    setForm({ ...emptyForm, pageNumber: String(sortedPages.length + 1) });
    setMessage("");
  }

  async function submit() {
    setSaving(true);
    setMessage("");
    try {
      const body = new FormData();
      body.set("pageNumber", form.pageNumber);
      body.set("title", form.title);
      body.set("content", form.content);
      if (form.file) body.set("image", form.file);

      const endpoint = form.id ? `/api/books/${bookId}/pages/${form.id}` : `/api/books/${bookId}/pages`;
      const response = await fetch(endpoint, { method: form.id ? "PUT" : "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không lưu được trang sách");
      await loadPages();
      resetForm();
      setMessage("Đã lưu trang sách.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không lưu được trang sách");
    } finally {
      setSaving(false);
    }
  }

  async function removePage(pageId: string) {
    if (!confirm("Xóa trang sách này?")) return;
    const response = await fetch(`/api/books/${bookId}/pages/${pageId}`, { method: "DELETE" });
    if (response.ok) await loadPages();
  }

  async function reorder(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedPages.findIndex((page) => page.id === active.id);
    const newIndex = sortedPages.findIndex((page) => page.id === over.id);
    const next = arrayMove(sortedPages, oldIndex, newIndex).map((page, index) => ({ ...page, pageNumber: index + 1 }));
    setPages(next);
    await fetch(`/api/books/${bookId}/pages/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: next.map((page) => page.id) })
    });
    await loadPages();
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500">Admin / Books</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Trang sách 3D</h1>
          <p className="mt-2 text-sm text-zinc-600">Book ID: <code className="rounded bg-zinc-100 px-1.5 py-0.5">{bookId}</code></p>
        </div>
        <a className="btn btn-secondary text-sm" href={`/books/${bookId}`} target="_blank">Mở trang sách</a>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <section className="panel h-fit p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">{form.id ? "Sửa trang" : "Thêm trang"}</h2>
            {form.id ? <button className="btn btn-secondary min-h-9 text-xs" onClick={resetForm}><X size={14} /> Hủy</button> : null}
          </div>

          <div
            className="mt-4 grid min-h-44 place-items-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              chooseFile(event.dataTransfer.files?.[0] ?? null);
            }}
          >
            {form.preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.preview} alt="Preview" className="max-h-56 w-full rounded-lg object-cover" />
            ) : (
              <div className="text-sm text-zinc-500">
                <ImagePlus className="mx-auto mb-3" />
                Kéo thả ảnh vào đây hoặc chọn file
              </div>
            )}
          </div>
          <input className="mt-3 w-full text-sm" type="file" accept="image/*" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />

          <div className="mt-4 grid gap-4">
            <label className="grid gap-2 text-sm font-medium">
              Số trang
              <input className="field" type="number" min={1} value={form.pageNumber} onChange={(event) => setForm((current) => ({ ...current, pageNumber: event.target.value }))} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Title
              <input className="field" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Content
              <textarea className="field min-h-28" value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} />
            </label>
            {message ? <p className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">{message}</p> : null}
            <button className="btn btn-primary" onClick={() => void submit()} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" size={16} /> : form.id ? <Save size={16} /> : <Plus size={16} />}
              {form.id ? "Lưu thay đổi" : "Thêm trang"}
            </button>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-semibold">Danh sách trang</h2>
          <p className="mt-1 text-sm text-zinc-500">Kéo icon grip để sắp xếp lại thứ tự trang.</p>
          {loading ? <div className="mt-5 text-sm text-zinc-500">Đang tải...</div> : null}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void reorder(event)}>
            <SortableContext items={sortedPages.map((page) => page.id)} strategy={verticalListSortingStrategy}>
              <div className="mt-5 grid gap-3">
                {sortedPages.map((page) => (
                  <SortablePageRow key={page.id} page={page} onEdit={editPage} onDelete={removePage} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </section>
      </div>
    </div>
  );
}

function SortablePageRow({ page, onEdit, onDelete }: { page: BookPage; onEdit: (page: BookPage) => void; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: page.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <article ref={setNodeRef} style={style} className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm sm:grid-cols-[auto_96px_1fr_auto] sm:items-center">
      <button className="grid size-9 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100" {...attributes} {...listeners} aria-label="Kéo sắp xếp">
        <GripVertical size={18} />
      </button>
      <Image src={page.imageUrl} alt={page.title || `Page ${page.pageNumber}`} width={120} height={80} className="h-20 w-24 rounded-md object-cover" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">Trang {page.pageNumber}: {page.title || "Không tiêu đề"}</p>
        <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{page.content || "Chưa có nội dung"}</p>
      </div>
      <div className="flex gap-2">
        <button className="btn btn-secondary min-h-9 px-3 text-xs" onClick={() => onEdit(page)}><Pencil size={14} /> Sửa</button>
        <button className="btn btn-secondary min-h-9 px-3 text-xs text-red-600" onClick={() => void onDelete(page.id)}><Trash2 size={14} /> Xóa</button>
      </div>
    </article>
  );
}
