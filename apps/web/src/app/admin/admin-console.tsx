"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, Copy, Database, ExternalLink, FileText, History, Home, KeyRound, Loader2, LogOut, Package, Radio, Save, ShieldCheck, ShoppingBag, Ticket, Truck, Users } from "lucide-react";
import { API_URL, money, StaticPage } from "@/lib/api";

type AdminData = {
  summary?: { counts: Record<string, number>; revenue: { total: number; payout: number; fee: number } };
  users: Array<{ id: string; email: string; role: string; createdAt: string }>;
  products: Array<{ id: string; slug: string; name: string; type: string; priceSell: number; priceRentMonth: number; depositFee: number; stock: number; images?: string[] }>;
  orders: Array<{ id: string; type: string; status: string; quantity: number; total: number; user?: { email: string }; product?: { name: string } }>;
  shows: Array<{ id: string; slug: string; name: string; status: string; soldTickets: number; totalTickets: number; ticketPrice: number; installationStatus: string; scannerCount: number; installationNote?: string | null; apiKeys?: Array<{ prefix: string; status: string }>; owner?: { email: string } }>;
  tickets: Array<{ id: string; status: string; quantity: number; totalAmount: number; payoutAmount: number; show: { name: string }; tickets: Array<{ id: string; isUsed: boolean }> }>;
  apiKeys: Array<{ id: string; prefix: string; quota: number; userId: string; rentalId: string | null; scopes: string[]; rateLimit: number; createdAt: string; user?: { email: string }; rental?: { appName: string; plan: string } | null }>;
  staticPages: StaticPage[];
  activityLogs: Array<{
    id: string;
    action: string;
    targetType?: string | null;
    targetId?: string | null;
    method?: string | null;
    path?: string | null;
    ip?: string | null;
    metadata?: Record<string, unknown> | null;
    createdAt: string;
    user?: { email: string; role: string };
  }>;
};

const emptyData: AdminData = { users: [], products: [], orders: [], shows: [], tickets: [], apiKeys: [], staticPages: [], activityLogs: [] };
const tabs = [
  ["activityLogs", "Lịch sử", History, "Hoạt động của user"],
  ["staticPages", "Trang tĩnh", FileText, "Menu, ảnh, nội dung quảng cáo"],
  ["products", "Sản phẩm", Package, "Giá, tồn kho, thiết bị"],
  ["orders", "Đơn hàng", Database, "Thuê hộp và mua linh kiện"],
  ["shows", "Show", Radio, "White-label events"],
  ["tickets", "Vé", Ticket, "Đơn vé và lượt quét"],
  ["apiKeys", "API Keys", KeyRound, "Cấp key cho cổng quét"],
  ["users", "Users", Users, "Tài khoản hệ thống"]
] as const;
const visitorLinks = [
  ["Trang chủ", "/", Home],
  ["Sản phẩm", "/san-pham", Package],
  ["Dịch vụ", "/dich-vu", FileText],
  ["Thuê API", "/thue-api", KeyRound],
  ["Giá rẻ", "/bang-gia", ShoppingBag],
  ["Giới thiệu", "/gioi-thieu", ShieldCheck],
  ["Thuê thiết bị", "/thue-thiet-bi", Truck],
  ["Tạo show", "/tao-show", Radio]
] as const;

export function AdminConsole() {
  const [token, setToken] = useState("");
  const [data, setData] = useState<AdminData>(emptyData);
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("activityLogs");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [onceKey, setOnceKey] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("smartqr_token") ?? "";
    setToken(saved);
    if (saved) void load(saved);
  }, []);

  const adminUser = useMemo(() => data.users.find((user) => user.role === "ADMIN"), [data.users]);

  async function request<T>(path: string, init?: RequestInit, overrideToken = token): Promise<T> {
    const method = init?.method?.toUpperCase() ?? "GET";
    let csrfToken: string | undefined;
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      const csrfResponse = await fetch(`${API_URL}/api/csrf-token`, {
        credentials: "include",
        signal: AbortSignal.timeout(10000)
      });
      if (!csrfResponse.ok) throw new Error("Không lấy được CSRF token.");
      csrfToken = (await csrfResponse.json() as { token?: string }).token;
      if (!csrfToken) throw new Error("CSRF token không hợp lệ.");
    }
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        ...(overrideToken ? { Authorization: `Bearer ${overrideToken}` } : {}),
        ...(init?.headers ?? {})
      },
      credentials: "include",
      signal: init?.signal ?? AbortSignal.timeout(10000)
    });
    if (res.status === 204) return undefined as T;
    if (res.status === 401) {
      throw new Error("ADMIN_SESSION_EXPIRED");
    }
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async function load(authToken = token) {
    setLoading(true);
    setMessage("");
    try {
      const [summary, users, products, orders, shows, tickets, apiKeys, staticPages, activityLogs] = await Promise.all([
        request<AdminData["summary"]>("/admin/summary", undefined, authToken),
        request<AdminData["users"]>("/admin/users", undefined, authToken),
        request<AdminData["products"]>("/admin/products", undefined, authToken),
        request<AdminData["orders"]>("/admin/orders", undefined, authToken),
        request<AdminData["shows"]>("/admin/shows", undefined, authToken),
        request<AdminData["tickets"]>("/admin/tickets", undefined, authToken),
        request<AdminData["apiKeys"]>("/admin/api-keys", undefined, authToken),
        request<AdminData["staticPages"]>("/admin/static-pages", undefined, authToken),
        request<AdminData["activityLogs"]>("/admin/activity-logs", undefined, authToken)
      ]);
      setData({ summary, users, products, orders, shows, tickets, apiKeys, staticPages, activityLogs });
    } catch (error) {
      if (error instanceof Error && error.message === "ADMIN_SESSION_EXPIRED") {
        window.localStorage.removeItem("smartqr_token");
        window.location.href = "/dang-nhap?next=/admin";
        return;
      }
      setMessage(error instanceof Error ? error.message : "Không tải được admin");
    } finally {
      setLoading(false);
    }
  }

  async function updateProduct(product: AdminData["products"][number], formData: FormData) {
    setMessage("");
    await request(`/admin/products/${product.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: String(formData.get("name")),
        price_sell: Number(formData.get("priceSell")),
        price_rent_month: Number(formData.get("priceRentMonth")),
        deposit_fee: Number(formData.get("depositFee")),
        stock: Number(formData.get("stock")),
        images: String(formData.get("imageUrl") || "").trim() ? [String(formData.get("imageUrl")).trim()] : []
      })
    });
    setMessage(`Đã lưu ${product.name}`);
    await load();
  }

  async function updateStaticPage(page: StaticPage, formData: FormData) {
    setMessage("");
    try {
      await request(`/admin/static-pages/${page.slug}`, {
        method: "PATCH",
        body: JSON.stringify({
          nav_label: String(formData.get("navLabel")),
          title: String(formData.get("title")),
          description: String(formData.get("description")),
          hero_image: String(formData.get("heroImage")),
          sort_order: Number(formData.get("sortOrder")),
          published: formData.get("published") === "on",
          cta_primary: JSON.parse(String(formData.get("ctaPrimary"))),
          cta_secondary: JSON.parse(String(formData.get("ctaSecondary")) || "null"),
          sections: JSON.parse(String(formData.get("sections")))
        })
      });
      setMessage(`Đã lưu trang ${page.navLabel}`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "JSON trang tĩnh không hợp lệ");
    }
  }

  async function updateShowStatus(id: string, status: string) {
    await request(`/admin/shows/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    setMessage("Đã cập nhật trạng thái show");
    await load();
  }

  async function updateShowInstallation(id: string, formData: FormData) {
    await request(`/admin/shows/${id}/installation`, {
      method: "PATCH",
      body: JSON.stringify({
        status: String(formData.get("installationStatus")),
        scanner_count: Number(formData.get("scannerCount")),
        note: String(formData.get("installationNote") ?? "")
      })
    });
    setMessage("Đã cập nhật trạng thái lắp đặt");
    await load();
  }

  async function createShowScanKey(showId: string) {
    setMessage("");
    try {
      const created = await request<{ api_key_once: string }>('/admin/shows/' + showId + '/scan-key', { method: "POST", body: "{}" });
      setOnceKey(created.api_key_once);
      setMessage("Đã cấp key máy quét. Raw key chỉ hiển thị một lần.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể cấp key máy quét.");
    }
  }

  async function rotateShowScanKey(showId: string) {
    setMessage("");
    try {
      const created = await request<{ api_key_once: string }>(`/admin/shows/${showId}/scan-key/rotate`, { method: "POST", body: "{}" });
      setOnceKey(created.api_key_once);
      setMessage("Đã thu hồi key cũ và cấp key mới. Raw key chỉ hiển thị một lần.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể cấp key mới.");
    }
  }

  async function copyOnceKey() {
    if (!onceKey) return;
    try {
      await navigator.clipboard.writeText(onceKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage("Không thể tự động copy. Hãy bôi đen và copy key thủ công.");
    }
  }

  async function createApiKey(formData: FormData) {
    const created = await request<{ api_key_once: string }>("/admin/api-keys", {
      method: "POST",
      body: JSON.stringify({ user_id: String(formData.get("userId")), rental_id: String(formData.get("rentalId")) })
    });
    setOnceKey(created.api_key_once);
    await load();
  }

  function logout() {
    window.localStorage.removeItem("smartqr_token");
    setToken("");
    setData(emptyData);
    setMessage("");
  }

  if (!token || message.includes("Admin role required") || message.includes("Missing admin token") || message.includes("Unauthorized")) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50 px-4">
        <div className="panel p-6">
          <ShieldCheck className="text-zinc-900" />
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">Admin SmartQR</h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-600">Đăng nhập bằng tài khoản admin để sửa menu, ảnh và nội dung quảng cáo của các trang tĩnh.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/dang-nhap" className="btn btn-primary"><ShieldCheck size={16} />Đăng nhập</Link>
            <Link href="/" className="btn btn-secondary">Xem trang public</Link>
          </div>
          {message && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
      <aside className="border-b border-zinc-200 bg-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col gap-6 p-4">
          <div className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900 text-white">
              <ShieldCheck size={18} />
            </span>
            <div>
              <b className="block tracking-tight">SmartQR Admin</b>
              <span className="text-xs text-zinc-500">PostgreSQL CMS console</span>
            </div>
          </div>

          <nav className="grid gap-6">
            <div>
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-normal text-zinc-400">Quản trị</p>
              <div className="flex gap-2 overflow-auto pb-1 lg:grid lg:overflow-visible lg:pb-0">
                {tabs.map(([id, label, Icon, hint]) => (
                  <button
                    key={id}
                    className={`flex min-w-40 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition lg:min-w-0 ${tab === id ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"}`}
                    onClick={() => setTab(id)}
                  >
                    <Icon size={16} />
                    <span>
                      <b className="block font-semibold">{label}</b>
                      <span className={`hidden text-xs lg:block ${tab === id ? "text-zinc-300" : "text-zinc-500"}`}>{hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-normal text-zinc-400">Xem public</p>
              <div className="grid gap-1">
                {visitorLinks.map(([label, href, Icon]) => (
                  <Link key={href} href={href} className="flex min-h-10 items-center justify-between rounded-lg px-3 text-sm text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950">
                    <span className="flex items-center gap-2"><Icon size={16} />{label}</span>
                    <ExternalLink size={14} className="text-zinc-400" />
                  </Link>
                ))}
              </div>
            </div>
          </nav>

          <button className="btn btn-secondary mt-auto text-sm" onClick={logout}>
            <LogOut size={16} />
            Đăng xuất admin
          </button>
        </div>
      </aside>

      <section className="min-w-0 px-4 py-6 md:px-8 md:py-10">
        <div className="mx-auto grid max-w-6xl gap-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-500">SmartQR Admin</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight">Quản lý website</h1>
              <p className="mt-3 max-w-2xl text-sm text-zinc-600">Sửa toàn bộ trang quảng cáo tĩnh, menu, ảnh hero, CTA và nội dung section từ PostgreSQL.</p>
            </div>
            <button className="btn btn-secondary text-sm" onClick={() => load()} disabled={loading}>{loading ? <Loader2 size={16} className="animate-spin" /> : <BarChart3 size={16} />}Tải lại</button>
          </div>

          {data.summary && (
            <div className="grid gap-4 md:grid-cols-4">
              {[
                ["Lịch sử", data.summary.counts.activityLogs ?? data.activityLogs.length],
                ["Trang tĩnh", data.summary.counts.staticPages ?? data.staticPages.length],
                ["Users", data.summary.counts.users],
                ["Vé paid", money(data.summary.revenue.total)]
              ].map(([label, value]) => (
                <div key={label} className="panel p-5">
                  <span className="text-sm text-zinc-500">{label}</span>
                  <b className="mt-2 block text-2xl">{value}</b>
                </div>
              ))}
            </div>
          )}

          {message && <p className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">{message}</p>}
          {onceKey && (
            <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-amber-950">Raw API key mới</p>
                  <p className="mt-1 text-xs text-amber-800">Hãy copy và lưu ngay. Key đầy đủ chỉ hiển thị một lần.</p>
                </div>
                <button type="button" className="btn btn-primary text-sm" onClick={() => void copyOnceKey()}>
                  <Copy size={16} />
                  {copied ? "Đã copy" : "Copy key"}
                </button>
              </div>
              <code className="mt-3 block select-all break-all rounded-lg border border-amber-200 bg-white p-3 text-sm text-zinc-900">{onceKey}</code>
            </section>
          )}

          {tab === "activityLogs" && (
            <SimpleTable
              rows={data.activityLogs.map((log) => [
                new Date(log.createdAt).toLocaleString("vi-VN"),
                log.user?.email ?? "",
                log.action,
                [log.targetType, log.targetId].filter(Boolean).join(": "),
                [log.method, log.path].filter(Boolean).join(" "),
                log.ip ?? "",
                log.metadata ? JSON.stringify(log.metadata) : ""
              ])}
            />
          )}
          {tab === "staticPages" && <section className="grid gap-4">{data.staticPages.map((page) => <StaticPageEditor key={page.id} page={page} onSave={updateStaticPage} />)}</section>}
          {tab === "products" && <section className="grid gap-3">{data.products.map((product) => <ProductEditor key={product.id} product={product} onSave={updateProduct} />)}</section>}
          {tab === "orders" && <SimpleTable rows={data.orders.map((order) => [order.id, order.user?.email ?? "", order.product?.name ?? "", order.type, order.status, money(order.total)])} />}
          {tab === "shows" && (
            <section className="grid gap-3">
              {data.shows.map((show) => (
                <article key={show.id} className="panel grid gap-4 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><b>{show.name}</b><p className="mt-1 text-sm text-zinc-600">{show.owner?.email} · {show.soldTickets}/{show.totalTickets} vé · {money(show.ticketPrice)}</p></div>
                    <select className="field w-36" value={show.status} onChange={(event) => updateShowStatus(show.id, event.target.value)}>
                      <option value="DRAFT">DRAFT</option>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="ENDED">ENDED</option>
                    </select>
                  </div>
                  <form action={(formData) => updateShowInstallation(show.id, formData)} className="grid gap-3 md:grid-cols-[180px_120px_1fr_auto]">
                    <select name="installationStatus" className="field" defaultValue={show.installationStatus}>
                      <option value="PENDING">Chưa xếp lịch</option>
                      <option value="SCHEDULED">Đã xếp lịch</option>
                      <option value="INSTALLING">Đang lắp đặt</option>
                      <option value="READY">Đã sẵn sàng</option>
                      <option value="BLOCKED">Bị chặn</option>
                    </select>
                    <input name="scannerCount" className="field" type="number" min="0" defaultValue={show.scannerCount} placeholder="Số máy" />
                    <input name="installationNote" className="field" defaultValue={show.installationNote ?? ""} placeholder="Ghi chú lắp đặt" />
                    <button className="btn btn-secondary text-sm">Lưu lắp đặt</button>
                  </form>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
                    <span>Key máy quét: {show.apiKeys?.find((key) => ["active", "deprecated"].includes(key.status))?.prefix ?? "chưa cấp"}</span>
                    {show.apiKeys?.some((key) => ["active", "deprecated"].includes(key.status)) ? (
                      <button className="btn btn-secondary text-xs" onClick={() => void rotateShowScanKey(show.id)}>Cấp key mới</button>
                    ) : (
                      <button className="btn btn-primary text-xs" onClick={() => void createShowScanKey(show.id)}>Cấp key cho máy quét</button>
                    )}
                  </div>
                </article>
              ))}
            </section>
          )}
          {tab === "tickets" && <SimpleTable rows={data.tickets.map((order) => [order.id, order.show.name, order.status, `${order.quantity} vé`, money(order.totalAmount), `${order.tickets.filter((ticket) => ticket.isUsed).length} đã quét`])} />}
          {tab === "apiKeys" && (
            <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
              <form action={createApiKey} className="panel grid h-fit gap-4 p-5">
                <h2 className="font-semibold">Tạo API key</h2>
                <select name="userId" className="field" defaultValue={adminUser?.id ?? data.users[0]?.id}>
                  {data.users.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
                </select>
                <input name="rentalId" className="field" placeholder="API rental ID dang ACTIVE" required />
                <button className="btn btn-primary text-sm"><KeyRound size={16} />Tạo key</button>
              </form>
              <SimpleTable rows={data.apiKeys.map((key) => [key.prefix, key.user?.email ?? key.userId, key.rental?.appName ?? key.rentalId ?? "-", `${key.quota} / ${key.rateLimit}rpm`, new Date(key.createdAt).toLocaleString("vi-VN")])} />
            </section>
          )}
          {tab === "users" && <SimpleTable rows={data.users.map((user) => [user.email, user.role, new Date(user.createdAt).toLocaleString("vi-VN"), user.id])} />}
        </div>
      </section>
    </div>
  );
}

function StaticPageEditor({ page, onSave }: { page: StaticPage; onSave: (page: StaticPage, formData: FormData) => Promise<void> }) {
  const [image, setImage] = useState(page.heroImage);

  return (
    <form action={(formData) => onSave(page, formData)} className="panel grid gap-5 p-5">
      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
          <img src={image} alt={page.title} className="aspect-[4/3] w-full object-cover" />
        </div>
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">/{page.slug === "home" ? "" : page.slug}</h2>
              <p className="mt-1 text-sm text-zinc-500">Sửa nội dung quảng cáo, menu và trạng thái xuất bản.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              <input name="published" type="checkbox" defaultChecked={page.published} />
              Xuất bản
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_100px]">
            <label className="grid gap-1 text-xs font-medium text-zinc-500">Tên menu<input name="navLabel" className="field" defaultValue={page.navLabel} /></label>
            <label className="grid gap-1 text-xs font-medium text-zinc-500">Thứ tự<input name="sortOrder" className="field" type="number" defaultValue={page.sortOrder} /></label>
          </div>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">Tiêu đề hero<input name="title" className="field" defaultValue={page.title} /></label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">Mô tả<textarea name="description" className="field min-h-24" defaultValue={page.description} /></label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">Ảnh hero<input name="heroImage" className="field" value={image} onChange={(event) => setImage(event.target.value)} /></label>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <label className="grid gap-1 text-xs font-medium text-zinc-500">CTA chính<textarea name="ctaPrimary" className="field min-h-28 font-mono text-xs" defaultValue={JSON.stringify(page.ctaPrimary, null, 2)} /></label>
        <label className="grid gap-1 text-xs font-medium text-zinc-500">CTA phụ<textarea name="ctaSecondary" className="field min-h-28 font-mono text-xs" defaultValue={JSON.stringify(page.ctaSecondary, null, 2)} /></label>
        <label className="grid gap-1 text-xs font-medium text-zinc-500 lg:col-span-1">Sections JSON<textarea name="sections" className="field min-h-28 font-mono text-xs" defaultValue={JSON.stringify(page.sections, null, 2)} /></label>
      </div>
      <button className="btn btn-primary w-fit text-sm"><Save size={16} />Lưu trang tĩnh</button>
    </form>
  );
}

function ProductEditor({ product, onSave }: { product: AdminData["products"][number]; onSave: (product: AdminData["products"][number], formData: FormData) => Promise<void> }) {
  const [image, setImage] = useState(product.images?.[0] ?? "");

  return (
    <form action={(formData) => onSave(product, formData)} className="panel grid gap-4 p-4 xl:grid-cols-[160px_1fr_auto]">
      <div className="aspect-[4/3] overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
        {image ? <img src={image} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-zinc-400"><Package size={34} /></div>}
      </div>
      <div className="grid gap-3">
        <div className="grid gap-3 lg:grid-cols-[1.5fr_120px_120px_120px_90px]">
          <label className="grid gap-1 text-xs font-medium text-zinc-500">Tên sản phẩm<input className="field" name="name" defaultValue={product.name} /></label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">Giá bán<input className="field" name="priceSell" type="number" defaultValue={product.priceSell} /></label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">Giá thuê<input className="field" name="priceRentMonth" type="number" defaultValue={product.priceRentMonth} /></label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">Cọc<input className="field" name="depositFee" type="number" defaultValue={product.depositFee} /></label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">Tồn<input className="field" name="stock" type="number" defaultValue={product.stock} /></label>
        </div>
        <label className="grid gap-1 text-xs font-medium text-zinc-500">Ảnh sản phẩm<input className="field" name="imageUrl" value={image} onChange={(event) => setImage(event.target.value)} /></label>
      </div>
      <button className="btn btn-primary self-end text-sm"><Save size={16} />Lưu</button>
    </form>
  );
}

function SimpleTable({ rows }: { rows: Array<Array<string>> }) {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <tbody className="divide-y divide-zinc-200">
            {rows.map((row, index) => (
              <tr key={index} className="align-top">
                {row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3 text-zinc-700">{cell}</td>)}
              </tr>
            ))}
            {!rows.length && <tr><td className="px-4 py-6 text-zinc-500">Chưa có dữ liệu.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
