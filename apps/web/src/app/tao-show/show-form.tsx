"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, Check, Copy, ExternalLink, ImagePlus, Loader2, MapPin, Monitor, Palette, Radio, Smartphone, Ticket } from "lucide-react";
import { api, money } from "@/lib/api";

type Result = { show_id: string; public_url: string; embed_code: string };
const colors = ["#18181b", "#0f766e", "#b45309", "#be123c", "#6d28d9", "#1d4ed8"];
const defaultBanner = "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=1600&q=80";

export function ShowForm() {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("Đêm Nhạc ABC");
  const [description, setDescription] = useState("Một đêm nhạc đặc biệt với trải nghiệm vé QR nhanh chóng và an toàn.");
  const [location, setLocation] = useState("Nhà hát Hòa Bình, TP.HCM");
  const [startAt, setStartAt] = useState("2026-10-01T20:00");
  const [ticketPrice, setTicketPrice] = useState(100000);
  const [totalTickets, setTotalTickets] = useState(500);
  const [banner, setBanner] = useState(defaultBanner);
  const [themeColor, setThemeColor] = useState(colors[0]);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  async function submit(formData: FormData) {
    setLoading(true); setError("");
    try {
      const created = await api<Result>("/shows", { method: "POST", body: JSON.stringify({ name, banner, theme_color: themeColor, location, start_at: startAt, ticket_price: ticketPrice, total_tickets: totalTickets, description, payout_account: { account: String(formData.get("payout_account")), bank: "DEMO Bank" } }) });
      if (created) setResult(created);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tạo được show. Vui lòng thử lại."); }
    finally { setLoading(false); }
  }

  return <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
    <form action={submit} className="panel overflow-hidden">
      <div className="border-b border-zinc-200 bg-gradient-to-r from-violet-50/70 via-white to-amber-50/50 p-5"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-lg bg-violet-100 text-violet-700"><Palette size={18} /></div><div><h2 className="font-semibold">Nội dung và trang trí</h2><p className="mt-1 text-sm text-zinc-500">Thiết kế landing bán vé theo nhận diện của show.</p></div></div></div>
      <div className="grid gap-6 p-5 md:p-6">
        <EditorSection number="01" title="Thông tin chính">
          <div className="grid gap-4"><Field label="Tên show"><input required className="field" value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="Mô tả landing"><textarea required className="field min-h-28" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={280} /><span className="text-right text-[11px] text-zinc-400">{description.length}/280</span></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Ngày giờ"><input required type="datetime-local" className="field" value={startAt} onChange={(event) => setStartAt(event.target.value)} /></Field><Field label="Địa điểm"><input required className="field" value={location} onChange={(event) => setLocation(event.target.value)} /></Field></div></div>
        </EditorSection>

        <EditorSection number="02" title="Banner và màu thương hiệu">
          <div className="grid gap-4"><Field label="Banner URL"><input className="field" value={banner} onChange={(event) => setBanner(event.target.value)} placeholder="https://..." /></Field><label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-violet-200 bg-violet-50/50 px-4 py-3 text-sm font-medium text-violet-700 transition hover:bg-violet-50"><ImagePlus size={16} />Tải banner từ máy<input className="sr-only" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setBanner(String(reader.result)); reader.readAsDataURL(file); }} /></label><div><p className="mb-3 text-xs font-medium text-zinc-500">Màu chủ đạo</p><div className="flex flex-wrap items-center gap-2">{colors.map((color) => <button key={color} type="button" onClick={() => setThemeColor(color)} className={`grid size-9 place-items-center rounded-full border-2 transition hover:scale-105 ${themeColor === color ? "border-zinc-900" : "border-white ring-1 ring-zinc-200"}`} style={{ backgroundColor: color }} aria-label={`Chọn màu ${color}`}>{themeColor === color && <Check size={15} className="text-white" />}</button>)}<label className="relative grid size-9 cursor-pointer place-items-center overflow-hidden rounded-full border border-zinc-200 bg-white"><Palette size={15} className="pointer-events-none" /><input type="color" value={themeColor} onChange={(event) => setThemeColor(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Chọn màu tùy chỉnh" /></label><code className="ml-1 text-xs text-zinc-500">{themeColor}</code></div></div></div>
        </EditorSection>

        <EditorSection number="03" title="Vé và thanh toán">
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Giá vé"><input required type="number" min={0} className="field" value={ticketPrice} onChange={(event) => setTicketPrice(Number(event.target.value))} /></Field><Field label="Số lượng vé"><input required type="number" min={1} className="field" value={totalTickets} onChange={(event) => setTotalTickets(Number(event.target.value))} /></Field></div><Field label="STK nhận tiền demo"><input required name="payout_account" className="field mt-4" defaultValue="0123456789" /></Field>
        </EditorSection>

        {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button className="btn btn-primary w-full" disabled={loading}>{loading ? <Loader2 size={16} className="animate-spin" /> : <Radio size={16} />}{loading ? "Đang tạo show..." : "Tạo show và xuất bản"}</button>
      </div>
    </form>

    <aside className="grid gap-4 xl:sticky xl:top-20">
      <section className="panel overflow-hidden"><div className="flex items-center justify-between border-b border-zinc-200 p-4"><div><h2 className="font-semibold">Xem trước trang public</h2><p className="mt-1 text-xs text-zinc-500">Cập nhật trực tiếp khi chỉnh sửa</p></div><div className="flex rounded-lg bg-zinc-100 p-1"><PreviewButton active={device === "desktop"} label="Desktop" onClick={() => setDevice("desktop")}><Monitor size={15} /></PreviewButton><PreviewButton active={device === "mobile"} label="Mobile" onClick={() => setDevice("mobile")}><Smartphone size={15} /></PreviewButton></div></div><div className="bg-zinc-100 p-3 sm:p-5"><div className={`mx-auto overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all ${device === "mobile" ? "max-w-[280px]" : "w-full"}`}><div className="relative min-h-[230px] bg-zinc-950 bg-cover bg-center p-5 text-white" style={{ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.18), rgba(0,0,0,.82)), url(${banner || defaultBanner})` }}><span className="rounded-full border border-white/20 bg-black/30 px-2 py-1 text-[9px] backdrop-blur">SMARTQR EVENT</span><div className="absolute inset-x-5 bottom-5"><h3 className={`font-semibold leading-tight tracking-tight ${device === "mobile" ? "text-2xl" : "text-3xl"}`}>{name || "Tên show"}</h3><p className="mt-2 line-clamp-2 text-[11px] leading-5 text-zinc-200">{description || "Mô tả show sẽ xuất hiện tại đây."}</p></div></div><div className="p-4"><div className="grid gap-2 text-[11px] text-zinc-600"><span className="flex items-center gap-2"><Calendar size={13} style={{ color: themeColor }} />{startAt ? new Date(startAt).toLocaleString("vi-VN") : "Chưa chọn thời gian"}</span><span className="flex items-center gap-2"><MapPin size={13} style={{ color: themeColor }} />{location || "Chưa nhập địa điểm"}</span></div><div className="mt-4 flex items-center justify-between gap-3"><div><span className="block text-[9px] uppercase text-zinc-400">Giá vé</span><b className="text-sm">{money(ticketPrice)}</b></div><button type="button" className="rounded-lg px-3 py-2 text-[11px] font-semibold text-white" style={{ backgroundColor: themeColor }}><Ticket size={12} className="mr-1 inline" />Mua vé</button></div></div></div></div></section>
      {result && <section className="panel border-emerald-200 p-5"><div className="flex items-center gap-2 text-emerald-700"><Check size={17} /><h2 className="font-semibold">Show đã được tạo</h2></div><div className="mt-4 grid gap-3"><Link className="btn btn-primary" href={result.public_url} target="_blank"><ExternalLink size={15} />Mở trang public</Link><div className="overflow-x-auto rounded-lg bg-zinc-50 p-3 font-mono text-[10px] text-zinc-600">{result.embed_code}</div><button type="button" className="btn btn-secondary bg-white text-xs" onClick={() => navigator.clipboard.writeText(result.embed_code)}><Copy size={14} />Copy iframe</button></div></section>}
    </aside>
  </div>;
}

function EditorSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) { return <section><div className="mb-4 flex items-center gap-2"><span className="grid size-6 place-items-center rounded-full bg-violet-50 text-[10px] font-semibold text-violet-700">{number}</span><h3 className="text-sm font-semibold">{title}</h3></div>{children}</section>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-2 text-sm font-medium">{label}{children}</label>; }
function PreviewButton({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: React.ReactNode }) { return <button type="button" title={label} aria-label={label} onClick={onClick} className={`grid size-8 place-items-center rounded-md transition ${active ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400"}`}>{children}</button>; }
