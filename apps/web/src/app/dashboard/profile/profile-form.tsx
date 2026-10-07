"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, MapPin, Save, UserRound } from "lucide-react";
import { api } from "@/lib/api";

type ProfileUser = {
  id: string; email: string; role: string;
  fullName: string | null; phone: string | null; addressLine: string | null;
  provinceName: string | null; provinceCode: string | null;
  districtName: string | null; districtCode: string | null;
  wardName: string | null; wardCode: string | null;
};
type MeResult = { user: ProfileUser };
type ProfileResult = MeResult & { access_token: string };
type LocationOption = { code: string; name: string };
const emptyAddress = { fullName: "", phone: "", addressLine: "", provinceName: "", provinceCode: "", districtName: "", districtCode: "", wardName: "", wardCode: "" };

export function ProfileForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState(emptyAddress);
  const [provinces, setProvinces] = useState<LocationOption[]>([]);
  const [districts, setDistricts] = useState<LocationOption[]>([]);
  const [wards, setWards] = useState<LocationOption[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function hydrate(user: ProfileUser) {
    setEmail(user.email); setRole(user.role);
    setAddress({
      fullName: user.fullName ?? "", phone: user.phone ?? "", addressLine: user.addressLine ?? "",
      provinceName: user.provinceName ?? "", provinceCode: user.provinceCode ?? "",
      districtName: user.districtName ?? "", districtCode: user.districtCode ?? "",
      wardName: user.wardName ?? "", wardCode: user.wardCode ?? ""
    });
  }

  function updateAddress(field: keyof typeof emptyAddress, value: string) {
    setAddress((current) => ({ ...current, [field]: value }));
  }

  useEffect(() => {
    void api<MeResult>("/auth/me", { cache: "no-store" }).then((result) => hydrate(result.user)).catch(() => setMessage("Không thể tải hồ sơ hiện tại."));
    void api<LocationOption[]>("/auth/locations/provinces", { cache: "no-store" })
      .then(setProvinces)
      .catch(() => setMessage("Không thể tải danh sách tỉnh/thành."))
      .finally(() => setLocationsLoading(false));
  }, []);

  useEffect(() => {
    if (!address.provinceCode) { setDistricts([]); return; }
    void api<LocationOption[]>(`/auth/locations/districts?provinceCode=${encodeURIComponent(address.provinceCode)}`, { cache: "no-store" })
      .then(setDistricts)
      .catch(() => setMessage("Không thể tải danh sách quận/huyện."));
  }, [address.provinceCode]);

  useEffect(() => {
    if (!address.districtCode) { setWards([]); return; }
    void api<LocationOption[]>(`/auth/locations/wards?districtCode=${encodeURIComponent(address.districtCode)}`, { cache: "no-store" })
      .then(setWards)
      .catch(() => setMessage("Không thể tải danh sách phường/xã."));
  }, [address.districtCode]);

  function chooseLocation(level: "province" | "district" | "ward", code: string, options: LocationOption[]) {
    const selected = options.find((item) => item.code === code);
    if (level === "province") {
      setAddress((current) => ({ ...current, provinceCode: code, provinceName: selected?.name ?? "", districtCode: "", districtName: "", wardCode: "", wardName: "" }));
      setDistricts([]); setWards([]);
    } else if (level === "district") {
      setAddress((current) => ({ ...current, districtCode: code, districtName: selected?.name ?? "", wardCode: "", wardName: "" }));
      setWards([]);
    } else {
      setAddress((current) => ({ ...current, wardCode: code, wardName: selected?.name ?? "" }));
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage("");
    try {
      const result = await api<ProfileResult>("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ email: email.trim(), ...(password.trim() ? { password: password.trim() } : {}), ...Object.fromEntries(Object.entries(address).map(([key, value]) => [key, value.trim()])) })
      });
      window.localStorage.setItem("smartqr_token", result.access_token);
      hydrate(result.user); setPassword(""); setMessage("Đã cập nhật hồ sơ và địa chỉ giao nhận.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể cập nhật hồ sơ.");
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit} className="panel overflow-hidden">
      <div className="border-b border-sky-200 bg-sky-50/60 p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-sky-100 text-sky-700"><UserRound size={18} /></span>
          <div><h2 className="font-semibold">Hồ sơ cá nhân</h2><p className="mt-1 text-sm text-zinc-600">Cập nhật tài khoản và địa chỉ giao nhận dùng cho đơn hàng.</p></div>
        </div>
      </div>
      <div className="grid gap-6 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium"><span className="flex items-center gap-2"><Mail size={14} className="text-zinc-400" />Email</span><input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label className="grid gap-2 text-sm font-medium">Vai trò<input className="field bg-zinc-50 font-medium text-zinc-500" value={role === "CUSTOMER" ? "Khách hàng" : role || "Đang tải..."} readOnly /></label>
        </div>

        <section className="grid gap-4 border-t border-zinc-200 pt-6">
          <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><MapPin size={17} /></span><div><h3 className="font-semibold">Địa chỉ giao nhận</h3><p className="mt-1 text-sm text-zinc-500">Chọn lần lượt tỉnh/thành, quận/huyện và phường/xã để hệ thống lưu đúng mã địa giới.</p></div></div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">Họ tên người nhận<input className="field" value={address.fullName} onChange={(event) => updateAddress("fullName", event.target.value)} maxLength={120} placeholder="Nguyễn Văn A" /></label>
            <label className="grid gap-2 text-sm font-medium">Số điện thoại<input className="field" type="tel" value={address.phone} onChange={(event) => updateAddress("phone", event.target.value)} maxLength={20} placeholder="0900 000 000" /></label>
          </div>
          <label className="grid gap-2 text-sm font-medium">Địa chỉ chi tiết<input className="field" value={address.addressLine} onChange={(event) => updateAddress("addressLine", event.target.value)} maxLength={255} placeholder="Số nhà, tên đường, tòa nhà..." /></label>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <LocationSelect label="Tỉnh / Thành phố" value={address.provinceCode} options={provinces} disabled={locationsLoading} placeholder={locationsLoading ? "Đang tải..." : "Chọn tỉnh/thành"} onChange={(code) => chooseLocation("province", code, provinces)} />
            <LocationSelect label="Quận / Huyện" value={address.districtCode} options={districts} disabled={!address.provinceCode} placeholder={address.provinceCode ? "Chọn quận/huyện" : "Chọn tỉnh/thành trước"} onChange={(code) => chooseLocation("district", code, districts)} />
            <LocationSelect label="Phường / Xã" value={address.wardCode} options={wards} disabled={!address.districtCode} placeholder={address.districtCode ? "Chọn phường/xã" : "Chọn quận/huyện trước"} onChange={(code) => chooseLocation("ward", code, wards)} />
          </div>
        </section>

        <label className="grid gap-2 border-t border-zinc-200 pt-6 text-sm font-medium">Mật khẩu mới<input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} placeholder="Để trống nếu không đổi" /></label>
        <div className="flex flex-wrap items-center gap-3"><button className="btn btn-primary text-sm" disabled={loading}>{loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{loading ? "Đang lưu..." : "Lưu thay đổi"}</button>{message && <p aria-live="polite" className="text-sm font-medium text-zinc-600">{message}</p>}</div>
      </div>
    </form>
  );
}

function LocationSelect({ label, value, options, disabled, placeholder, onChange }: { label: string; value: string; options: LocationOption[]; disabled: boolean; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-medium">{label}
      <select className="field min-w-0 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
      </select>
    </label>
  );
}
