"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, ImagePlus, Radio } from "lucide-react";
import { api } from "@/lib/api";

type Result = { show_id: string; public_url: string; embed_code: string };

export function ShowForm() {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState("");
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    try {
      const payload = {
        name: String(formData.get("name")),
        banner: banner || String(formData.get("banner")),
        theme_color: String(formData.get("theme_color")),
        location: String(formData.get("location")),
        start_at: String(formData.get("start_at")),
        ticket_price: Number(formData.get("ticket_price")),
        total_tickets: Number(formData.get("total_tickets")),
        description: String(formData.get("description")),
        payout_account: { account: String(formData.get("payout_account")), bank: "DEMO Bank" }
      };
      const created = await api<Result>("/shows", { method: "POST", body: JSON.stringify(payload) });
      if (!created) return;
      setResult(created);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Khong tao duoc show. Vui long thu lai.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <form action={submit} className="panel grid gap-5 p-6">
        <label className="grid gap-2 text-sm font-medium">
          Ten show
          <input required name="name" className="field" defaultValue="Dem Nhac ABC" />
        </label>
        <div className="grid gap-3">
          <label className="grid gap-2 text-sm font-medium">
            Banner URL
            <input name="banner" className="field" placeholder="https://..." />
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700 transition hover:border-zinc-400">
            <ImagePlus size={16} />
            Upload banner demo
            <input
              className="sr-only"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setBanner(String(reader.result));
                reader.readAsDataURL(file);
              }}
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Mau chu dao
            <input name="theme_color" type="color" className="field h-12" defaultValue="#18181b" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Ngay gio
            <input required name="start_at" type="datetime-local" className="field" defaultValue="2026-10-01T20:00" />
          </label>
        </div>
        <label className="grid gap-2 text-sm font-medium">
          Dia diem
          <input required name="location" className="field" defaultValue="Nha hat Hoa Binh, TP.HCM" />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Mo ta
          <textarea name="description" className="field min-h-24" defaultValue="Show white-label demo voi QR ticket." />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Gia ve
            <input required name="ticket_price" type="number" className="field" defaultValue={100000} />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            So luong ve
            <input required name="total_tickets" type="number" className="field" defaultValue={500} />
          </label>
        </div>
        <label className="grid gap-2 text-sm font-medium">
          STK nhan tien demo
          <input required name="payout_account" className="field" defaultValue="0123456789" />
        </label>
        <button className="btn btn-primary w-fit" disabled={loading}>
          <Radio size={16} />
          {loading ? "Dang tao" : "Tao show"}
        </button>
      </form>
      <aside className="panel h-fit p-6">
        <h2 className="text-xl font-semibold tracking-tight">Ket qua</h2>
        {banner && (
          <div
            className="mt-5 aspect-video rounded-lg border border-zinc-200 bg-cover bg-center"
            style={{ backgroundImage: `url(${banner})` }}
            aria-label="Preview banner"
          />
        )}
        {error ? (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
            {error}
          </div>
        ) : null}
        {result ? (
          <div className="mt-5 grid gap-4 text-sm">
            <Link className="btn btn-primary" href={result.public_url}>Mo public URL</Link>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs">{result.embed_code}</div>
            <button className="btn btn-secondary" onClick={() => navigator.clipboard.writeText(result.embed_code)}>
              <Copy size={16} />
              Copy iframe
            </button>
          </div>
        ) : !error ? (
          <p className="mt-4 text-sm text-zinc-600">Public URL va embed iframe se hien sau khi tao.</p>
        ) : null}
      </aside>
    </div>
  );
}
