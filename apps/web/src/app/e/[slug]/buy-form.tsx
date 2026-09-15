"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Ticket } from "lucide-react";
import { API_URL, api, money } from "@/lib/api";

export function BuyForm({ slug, price }: { slug: string; price: number }) {
  const [quantity, setQuantity] = useState(2);
  const [buyerEmail, setBuyerEmail] = useState("buyer@smartqr.vn");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = window.localStorage.getItem("smartqr_token");
    if (!token) return;
    void fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.ok ? res.json() : null)
      .then((result) => {
        if (result?.user?.email) setBuyerEmail(result.user.email);
      })
      .catch(() => undefined);
  }, []);

  async function submit(formData: FormData) {
    setMessage("");
    const buyerName = String(formData.get("buyer_name") ?? "").trim();
    const buyerPhone = String(formData.get("buyer_phone") ?? "").trim();
    const buyerNote = String(formData.get("buyer_note") ?? "").trim();
    const email = buyerEmail.trim();
    const safeQuantity = Number.isFinite(quantity) ? quantity : 0;

    if (!buyerName || !email || !buyerPhone) {
      setMessage("Vui lòng nhập đầy đủ họ tên, email và số điện thoại để chủ show dễ quản lý vé.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage("Email nhận vé chưa đúng định dạng.");
      return;
    }
    if (buyerPhone.replace(/\D/g, "").length < 9) {
      setMessage("Số điện thoại chưa hợp lệ. Vui lòng nhập ít nhất 9 chữ số.");
      return;
    }
    if (safeQuantity < 1 || safeQuantity > 10) {
      setMessage("Số vé mỗi lần mua phải từ 1 đến 10.");
      return;
    }

    setLoading(true);
    try {
      const result = await api<{ payment_url: string }>(`/e/${slug}/buy`, {
        method: "POST",
        body: JSON.stringify({
          buyer_name: buyerName,
          buyer_email: email,
          buyer_phone: buyerPhone,
          buyer_note: buyerNote,
          quantity: safeQuantity
        })
      });
      window.location.href = result.payment_url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không tạo được link thanh toán. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={submit} className="panel grid gap-4 p-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Mua vé demo</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Không cần tài khoản. Vui lòng nhập đầy đủ thông tin để chủ show quản lý danh sách khách mua vé.
        </p>
      </div>

      {message && (
        <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 shrink-0" size={16} />
          <p>{message}</p>
        </div>
      )}

      <label className="grid gap-2 text-sm font-medium">
        Họ tên <span className="sr-only">bắt buộc</span>
        <input required name="buyer_name" className="field" defaultValue="Khách demo" placeholder="Nhập họ tên người mua" />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Email nhận vé <span className="sr-only">bắt buộc</span>
        <input required name="buyer_email" type="email" className="field" value={buyerEmail} onChange={(event) => setBuyerEmail(event.target.value)} placeholder="email@example.com" />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Số điện thoại <span className="sr-only">bắt buộc</span>
        <input required name="buyer_phone" className="field" defaultValue="0900000000" inputMode="tel" minLength={9} placeholder="Nhập số điện thoại" />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Ghi chú
        <textarea name="buyer_note" className="field min-h-20" placeholder="Ví dụ: cần hỗ trợ check-in nhóm" />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Số vé
        <input className="field" type="number" min={1} max={10} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
      </label>
      <div className="flex items-center justify-between rounded-lg bg-zinc-50 p-4">
        <span>Tổng thanh toán</span>
        <b>{money(price * quantity)}</b>
      </div>
      <button disabled={loading} className="btn btn-primary">
        <Ticket size={16} />
        {loading ? "Đang tạo link" : "Thanh toán PayOS demo"}
      </button>
    </form>
  );
}
