export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || API_URL;

export class NetworkError extends Error {}

export type Product = {
  id: string;
  slug: string;
  name: string;
  type: "IOT_MINI" | "IOT_PRO" | "COMPONENT";
  priceSell: number;
  priceRentMonth: number;
  depositFee: number;
  stock: number;
  images?: string[];
  specs: Record<string, string>;
};

export type Show = {
  id: string;
  slug: string;
  name: string;
  description: string;
  bannerUrl: string;
  themeColor: string;
  location: string;
  startAt: string;
  ticketPrice: number;
  totalTickets: number;
  soldTickets: number;
};

export type StaticPage = {
  id: string;
  slug: string;
  navLabel: string;
  title: string;
  description: string;
  heroImage: string;
  ctaPrimary: { label: string; href: string };
  ctaSecondary?: { label: string; href: string } | null;
  sections: Array<{
    kind: "cards" | "band" | "stats" | "pricing" | "timeline";
    title: string;
    subtitle?: string;
    body?: string;
    items?: Array<{ title?: string; body?: string; href?: string; value?: string; label?: string; price?: string }>;
  }>;
  sortOrder: number;
  published: boolean;
};

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const shouldRevalidate = !init?.method && !init?.cache;
  const token = typeof window !== "undefined" ? window.localStorage.getItem("smartqr_token") : null;
  const isStateChanging = Boolean(init?.method && !["GET", "HEAD", "OPTIONS"].includes(init.method.toUpperCase()));
  let csrfToken: string | null = null;
  if (isStateChanging && typeof window !== "undefined") {
    const csrfResponse = await fetch(`${API_URL}/api/csrf-token`, { credentials: "include", signal: AbortSignal.timeout(10000) });
    if (!csrfResponse.ok) throw new NetworkError("Không lấy được CSRF token.");
    csrfToken = (await csrfResponse.json() as { token?: string }).token ?? null;
    if (!csrfToken) throw new NetworkError("CSRF token không hợp lệ.");
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers || {})
      },
      credentials: "include",
      signal: init?.signal ?? AbortSignal.timeout(10000),
      next: shouldRevalidate ? { revalidate: 30 } : undefined
    });
  } catch (error) {
    const message = error instanceof DOMException && error.name === "TimeoutError"
      ? "API phản hồi quá lâu. Thử tải lại hoặc kiểm tra backend."
      : `Không kết nối được API tại ${API_URL}. Kiểm tra backend đang chạy.`;
    throw new NetworkError(message);
  }
  if (res.status === 204) return undefined as T;
  if (res.redirected && res.url.includes("/dang-nhap")) {
    if (typeof window !== "undefined") window.location.href = "/dang-nhap";
    return new Promise<T>(() => {});
  }
  const isAuthRequest = path === "/auth/login" || path === "/auth/register";
  if (res.status === 401 && !isAuthRequest && !path.startsWith("/api/v1/")) {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("smartqr_token");
      const next = `${window.location.pathname}${window.location.search}`;
      window.location.href = `/dang-nhap?next=${encodeURIComponent(next)}`;
    }
    return new Promise<T>(() => {});
  }
  if (!res.ok) {
    const text = await res.text();
    try {
      const body = JSON.parse(text) as { message?: string; error?: string };
      throw new Error(body.message ?? body.error ?? text);
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error(text);
      throw error;
    }
  }
  return res.json();
}

export function money(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}
