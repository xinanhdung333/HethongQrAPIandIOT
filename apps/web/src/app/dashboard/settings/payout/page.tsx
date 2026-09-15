"use client";

import { FormEvent, useEffect, useState } from "react";
import { Eye, Landmark, Save, ShieldCheck, Trash2, Upload, Wallet } from "lucide-react";
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

  async function load() {
    setSettings(await api<Settings>("/api/v1/account/settings", { cache: "no-store" }));
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
    const result = await api<{ account: PayoutAccount }>(`/api/v1/account/payout-accounts/${id}/reveal`, { method: "POST", body: JSON.stringify({ password }) });
    setRevealed(current => ({ ...current, [id]: result.account.method === "BANK" ? result.account.accountNumber ?? "" : result.account.walletId ?? "" }));
  }

  return (
    <div>
      <div>
        <p className="text-sm font-medium text-zinc-500">Settings</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Avatar va payout</h1>
        <p className="mt-2 text-sm text-zinc-600">Quản lý avatar, tài khoản ngân hàng/ví và mặc định nhận tiền cho API payment split.</p>
      </div>
      {message && <p className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">{message}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        <section className="panel p-5">
          <h2 className="font-semibold">Ho so</h2>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 text-lg font-semibold">
              {settings?.avatarUrl ? <img src={settings.avatarUrl} alt="avatar" className="h-full w-full object-cover" /> : settings?.email?.slice(0, 1).toUpperCase()}
            </div>
            <div><b>{settings?.email ?? "..."}</b><p className="mt-1 text-xs text-zinc-500">jpg/png/webp toi da 2MB</p></div>
          </div>
          <form onSubmit={uploadAvatar} className="mt-5 grid gap-3">
            <input name="avatar" type="file" accept="image/png,image/jpeg,image/webp" className="field" />
            <button className="btn btn-secondary text-sm"><Upload size={16} /> Upload avatar</button>
          </form>
        </section>

        <form action={createAccount} className="panel grid gap-4 p-5">
          <h2 className="font-semibold">Thêm tài khoản payout</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">Loại<select name="method" className="field"><option value="BANK">Bank</option><option value="WALLET">Wallet</option></select></label>
            <label className="grid gap-1 text-sm">Tên chủ TK<input name="account_name" className="field" required placeholder="Nguyen Van A" /></label>
            <label className="grid gap-1 text-sm">Ngân hàng<input name="bank_name" className="field" placeholder="VCB / ACB / MB..." /></label>
            <label className="grid gap-1 text-sm">Số tài khoản<input name="account_number" className="field" placeholder="0123456789" /></label>
            <label className="grid gap-1 text-sm">Ví<input name="wallet_type" className="field" placeholder="Momo / ZaloPay..." /></label>
            <label className="grid gap-1 text-sm">Wallet ID<input name="wallet_id" className="field" placeholder="phone/email/id" /></label>
          </div>
          <label className="flex items-center gap-2 text-sm"><input name="is_default" type="checkbox" /> Đặt làm mặc định</label>
          <button className="btn btn-primary w-fit text-sm"><Save size={16} /> Lưu payout account</button>
        </form>
      </div>

      <section className="panel mt-6 overflow-hidden">
        <div className="border-b border-zinc-200 bg-zinc-50 p-5"><h2 className="font-semibold">Tài khoản đang lưu</h2></div>
        <div className="divide-y divide-zinc-200">
          {settings?.payoutAccounts.map(account => (
            <article key={account.id} className="flex flex-wrap items-center justify-between gap-4 p-5 text-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100">{account.method === "BANK" ? <Landmark size={18} /> : <Wallet size={18} />}</span>
                <div><b>{account.label}</b><p className="mt-1 text-zinc-500">{account.accountName} {account.isDefault ? "- Mặc định" : ""}</p>{revealed[account.id] && <p className="mt-1 font-mono text-xs text-zinc-900">{revealed[account.id]}</p>}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-secondary text-sm" onClick={() => void setDefault(account.id)} disabled={account.isDefault}><ShieldCheck size={16} /> Default</button>
                <button className="btn btn-secondary text-sm" onClick={() => void reveal(account.id)}><Eye size={16} /> Reveal</button>
                <button className="btn btn-secondary text-sm" onClick={() => void remove(account.id)}><Trash2 size={16} /> Xoa</button>
              </div>
            </article>    
          ))}
          {!settings?.payoutAccounts.length && <p className="p-5 text-sm text-zinc-500">Chưa có tài khoản payout.</p>}
        </div>
      </section>

      <section className="panel mt-6 p-5">
        <h2 className="font-semibold">Re-auth</h2>
        <p className="mt-2 text-sm text-zinc-600">Nhập mật khẩu để reveal số tài khoản/ví. Hệ thống ghi audit mỗi lần reveal.</p>
        <input className="field mt-3 max-w-sm" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="M  ật khẩu hiện tại" />
      </section>
    </div>
  );
}
