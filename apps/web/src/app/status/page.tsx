"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { API_URL } from "@/lib/api";

type StatusPayload = {
  status: "operational" | "degraded" | "down";
  label: string;
  checked_at: string;
  uptime_24h: number | null;
  uptime_7d: number | null;
  uptime_30d: number | null;
  latency_ms: number | null;
  incidents: Array<{ id: string; title: string; status: string; started_at: string; resolved_at: string | null }>;
};

async function getStatus(): Promise<StatusPayload | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/status`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default function StatusPage() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  async function refresh() {
    const next = await getStatus();
    setStatus(next);
    setLastUpdated(new Date().toISOString());
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const tone = status?.status === "operational" ? "emerald" : status?.status === "degraded" ? "amber" : "red";
  return (
    <main className="shell py-16 md:py-24">
      <section className="panel overflow-hidden">
        <div className={`border-b p-6 ${tone === "emerald" ? "border-emerald-200 bg-emerald-50" : tone === "amber" ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-600">SmartQR public status</p>
              <h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold tracking-tight text-zinc-950">
                {tone === "emerald" ? <CheckCircle2 className="text-emerald-600" /> : <AlertTriangle className={tone === "amber" ? "text-amber-600" : "text-red-600"} />}
                {loading ? "Dang kiem tra" : status?.label ?? "Down"}
              </h1>
              <p className="mt-3 text-sm text-zinc-600">Trang nay tu dong cap nhat moi 15 giay va chi hien thi uptime, latency, incident public.</p>
            </div>
            <div className="rounded-lg border border-white/70 bg-white px-4 py-3 text-sm text-zinc-600">
              <Clock size={16} className="mb-2" />
              Checked: {status ? new Date(status.checked_at).toLocaleString("vi-VN") : "API khong phan hoi"}
              <button className="btn btn-secondary mt-3 w-full text-xs" onClick={() => void refresh()}><RefreshCw size={14} /> Refresh</button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-4">
          <Metric label="Uptime 24h" value={formatPct(status?.uptime_24h)} />
          <Metric label="Uptime 7d" value={formatPct(status?.uptime_7d)} />
          <Metric label="Uptime 30d" value={formatPct(status?.uptime_30d)} />
          <Metric label="Latency" value={status?.latency_ms == null ? "-" : `${status.latency_ms}ms`} />
        </div>
        <p className="border-t border-zinc-200 px-6 py-3 text-xs text-zinc-500">Lan cap nhat UI: {lastUpdated ? new Date(lastUpdated).toLocaleString("vi-VN") : "-"}</p>
      </section>

      <section className="panel mt-6 p-6">
        <div className="flex items-center gap-2">
          <Activity size={18} />
          <h2 className="font-semibold">Recent incidents</h2>
        </div>
        <div className="mt-4 grid gap-3">
          {status?.incidents?.map((incident) => (
            <article key={incident.id} className="rounded-lg border border-zinc-200 p-4 text-sm">
              <div className="flex flex-wrap justify-between gap-3"><b>{incident.title}</b><span>{incident.status}</span></div>
              <p className="mt-1 text-zinc-500">{new Date(incident.started_at).toLocaleString("vi-VN")} - {incident.resolved_at ? new Date(incident.resolved_at).toLocaleString("vi-VN") : "dang xu ly"}</p>
            </article>
          ))}
          {!status?.incidents?.length && <p className="text-sm text-zinc-500">Chua co incident public nao.</p>}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-zinc-200 p-4"><span className="text-sm text-zinc-500">{label}</span><b className="mt-2 block text-2xl tracking-tight">{value}</b></div>;
}

function formatPct(value?: number | null) {
  return value == null ? "-" : `${value}%`;
}
