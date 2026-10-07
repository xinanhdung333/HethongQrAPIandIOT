"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Eye, Landmark, Loader2, Save, ShieldCheck, Trash2, Upload, Wallet } from "lucide-react";
import { api } from "@/lib/api";

type PayoutAccount = {
  id: string; method: "BANK" | "WALLET"; bankName: string | null; accountNumber: string | null; accountName: string; branch: string | null; walletType: string | null; walletId: string | null; isDefault: boolean; status: string; label: string;
};
type Settings = { id: string; email: string; avatarUrl: string | null; payoutAccounts: PayoutAccount[] };

export default function PayoutSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string>>( {} );
  const [method, setMethod] = useState<"BANK" | "WALLET">("BANK");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setSettings(await api<Settings>("/api/v1/account/settings", { cache: "no-store" })); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load().catch(error => setMessage(error instanceof Error ? error.message : "Khong tai duoc settings.")); }, []);

  async function uploadAvatar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = (event.currentTarget.elements.namedItem("avatar") as HTMLInputElement);
    const file = input.files?.[0];
    if (!file) return setMessage("Chon anh avatar truoc.");
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024) return setMessage("Avatar can la png/jpg/webp va <= 2MB.");
    const avatar_data_url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    await api("/api/v1/account/avatar", { method: "POST", body: JSON.stringify({ avatar_data_url }) });
    setMessage("Da cap nhat avatar.");
    await load();
  }

  async function createAccount(formData: FormData) {
    await api("/api/v1/account/payout-accounts", {
      method: "POST",
      body: JSON.stringify({
        method: String(formData.get("method")),
        bank_name: String(formData.get("bank_name") || ""),
        account_number: String(formData.get("account_number") || ""),
        account_name: String(formData.get("account_name") || ""),
        branch: String(formData.get("branch") || ""),
        wallet_type: String(formData.get("wallet_type") || ""),
        wallet_id: String(formData.get("wallet_id") || ""),
        is_default: formData.get("is_default") === "on"
      })
    });
    setMessage("Da them tai khoan nhan tien.");
    await load();
  }

  async function setDefault(id: string) {
    await api(`/api/v1/account/payout-accounts/${id}/default`, { method: "POST" });
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Xoá tài khoản payout này? Giao dịch cũ vẫn giữ snapshot.")) return;
    await api(`/api/v1/account/payout-accounts/${id}`, { method: "DELETE" });
    await load();
  }

  async function reveal(id: string) {
    if (!password) return setMessage("Nhập mật khẩu hiện tại trước khi xem thông tin tài khoản.");
    const result = await api<{ account: PayoutAccount }>(`/api/v1/account/payout-accounts/${id}/reveal`, { method: "POST", body: JSON.stringify({ password }) });
    setRevealed(current => ({ ...current, [id]: result.account.method === "BANK" ? result.account.accountNumber ?? "" : result.account.walletId ?? "" }));
  }

  return (
    <main className="mx-auto min-w-0 max-w-[1200px] py-3 md:py-5">
      <div>
        <p className="text-sm font-medium text-zinc-500">Payout Settings</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Hồ sơ và tài khoản nhận tiền</h1>
        <p className="mt-2 text-sm text-zinc-600">Quản lý danh tính và tài khoản mặc định nhận tiền từ payment split.</p>
      </div>
      {message && <p className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3"><Summary icon={Landmark} label="Tài khoản đã lưu" value={String(settings?.payoutAccounts.length ?? 0)} tone="violet" /><Summary icon={CheckCircle2} label="Tài khoản mặc định" value={settings?.payoutAccounts.some((item) => item.isDefault) ? "Đã thiết lập" : "Chưa thiết lập"} tone="emerald" /><Summary icon={ShieldCheck} label="Bảo mật" value="Re-auth khi xem" tone="amber" /></div>

      {loading && <div className="panel mt-6 flex items-center gap-3 p-5 text-sm text-zinc-500"><Loader2 size={16} className="animate-spin" />Đang tải cài đặt payout...</div>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        <section className="panel overflow-hidden"><div className="border-b border-violet-200 bg-violet-50/60 p-5"><h2 className="font-semibold">Hồ sơ</h2><p className="mt-1 text-sm text-zinc-500">Ảnh đại diện cho tài khoản SmartQR.</p></div><div className="p-5">
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 text-lg font-semibold">
              {settings?.avatarUrl ? <img src={settings.avatarUrl} alt="avatar" className="h-full w-full object-cover" /> : settings?.email?.slice(0, 1).toUpperCase()}
            </div>
            <div><b>{settings?.email ?? "..."}</b><p className="mt-1 text-xs text-zinc-500">JPG, PNG hoặc WebP · tối đa 2 MB</p></div>
          </div>
          <form onSubmit={uploadAvatar} className="mt-5 grid gap-3">
            <input name="avatar" type="file" accept="image/png,image/jpeg,image/webp" className="field" />
            <button className="btn btn-secondary bg-white text-sm"><Upload size={16} />Tải ảnh đại diện</button>
          </form>
        </div></section>

        <form action={createAccount} className="panel overflow-hidden"><div className="border-b border-emerald-200 bg-emerald-50/60 p-5"><h2 className="font-semibold">Thêm tài khoản nhận tiền</h2><p className="mt-1 text-sm text-zinc-500">Thông tin được mã hóa và chỉ hiển thị lại sau re-auth.</p></div><div className="grid gap-4 p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">Loại<select name="method" className="field" value={method} onChange={(event) => setMethod(event.target.value as "BANK" | "WALLET")}><option value="BANK">Ngân hàng</option><option value="WALLET">Ví điện tử</option></select></label>
            <label className="grid gap-1 text-sm">Tên chủ tài khoản<input name="account_name" className="field" required placeholder="NGUYEN VAN A" /></label>
            {method === "BANK" ? <><label className="grid gap-1 text-sm">Ngân hàng<input name="bank_name" className="field" required placeholder="VCB / ACB / MB..." /></label><label className="grid gap-1 text-sm">Số tài khoản<input name="account_number" className="field" required placeholder="0123456789" /></label></> : <><label className="grid gap-1 text-sm">Loại ví<input name="wallet_type" className="field" required placeholder="MoMo / ZaloPay..." /></label><label className="grid gap-1 text-sm">Wallet ID<input name="wallet_id" className="field" required placeholder="Số điện thoại/email/ID" /></label></>}
          </div>
          <label className="flex items-center gap-2 text-sm"><input name="is_default" type="checkbox" className="size-4 accent-zinc-900" />Đặt làm tài khoản mặc định</label>
          <button className="btn btn-primary w-fit text-sm"><Save size={16} />Lưu tài khoản</button>
        </div></form>
      </div>

      <section className="panel mt-6 overflow-hidden">
        <div className="border-b border-zinc-200 bg-zinc-50 p-5"><h2 className="font-semibold">Tài khoản đang lưu</h2><p className="mt-1 text-sm text-zinc-500">Tài khoản mặc định được dùng cho giao dịch mới.</p></div>
        <div className="grid gap-3 p-4 md:grid-cols-2 md:p-5">
          {settings?.payoutAccounts.map(account => (
            <article key={account.id} className={`rounded-xl border p-4 text-sm ${account.isDefault ? "border-emerald-200 bg-emerald-50/40" : "border-zinc-200"}`}>
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${account.isDefault ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100"}`}>{account.method === "BANK" ? <Landmark size={18} /> : <Wallet size={18} />}</span>
                <div><div className="flex flex-wrap items-center gap-2"><b>{account.label}</b>{account.isDefault && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Mặc định</span>}</div><p className="mt-1 text-zinc-500">{account.accountName}</p>{revealed[account.id] && <p className="mt-2 rounded bg-white p-2 font-mono text-xs text-zinc-900">{revealed[account.id]}</p>}</div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn btn-secondary h-9 bg-white text-xs" onClick={() => void setDefault(account.id)} disabled={account.isDefault}><ShieldCheck size={14} />Đặt mặc định</button>
                <button className="btn btn-secondary h-9 bg-white text-xs" onClick={() => void reveal(account.id)}><Eye size={14} />Xem</button>
                <button className="btn btn-secondary h-9 bg-white text-xs text-red-600" onClick={() => void remove(account.id)}><Trash2 size={14} />Xóa</button>
              </div>
            </article>    
          ))}
          {!settings?.payoutAccounts.length && <p className="p-5 text-sm text-zinc-500">Chưa có tài khoản nhận tiền.</p>}
        </div>
      </section>

      <section className="panel mt-6 p-5">
        <div className="flex items-center gap-2"><ShieldCheck size={17} className="text-amber-700" /><h2 className="font-semibold">Xác thực lại</h2></div>
        <p className="mt-2 text-sm text-zinc-600">Nhập mật khẩu trước khi xem số tài khoản hoặc ví. Mỗi lần xem đều được ghi vào audit log.</p>
        <input className="field mt-3 max-w-sm" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mật khẩu hiện tại" />
      </section>
    </main>
  );
}

function Summary({ icon: Icon, label, value, tone }: { icon: typeof Landmark; label: string; value: string; tone: "violet" | "emerald" | "amber" }) { const color = tone === "violet" ? "bg-violet-50 text-violet-700" : tone === "emerald" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"; return <div className="panel min-w-0 p-4"><span className={`grid size-8 place-items-center rounded-lg ${color}`}><Icon size={16} /></span><span className="mt-3 block truncate text-xs text-zinc-500">{label}</span><b className="mt-1 block truncate text-base tracking-tight sm:text-xl">{value}</b></div>; }
