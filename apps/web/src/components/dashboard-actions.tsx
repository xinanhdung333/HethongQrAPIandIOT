"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Power } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export function ReturnRentalButton({ id, disabled }: { id: string; disabled?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const result = await api(`/rentals/${id}/return`, { method: "PATCH", body: "{}" });
      if (result) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="btn btn-secondary text-sm" disabled={disabled || loading} onClick={submit}>
      {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
      Trả thiết bị
    </button>
  );
}

export function EndShowButton({ id, disabled }: { id: string; disabled?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const result = await api(`/shows/${id}/end`, { method: "PATCH", body: "{}" });
      if (result) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="btn btn-secondary text-sm" disabled={disabled || loading} onClick={submit}>
      {loading ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
      Kết thúc
    </button>
  );
}
