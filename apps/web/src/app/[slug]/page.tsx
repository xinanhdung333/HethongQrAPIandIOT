import { notFound } from "next/navigation";
import { StaticPageRenderer } from "@/components/static-page-renderer";
import { api, type StaticPage } from "@/lib/api";

export const dynamic = "force-dynamic";

const reservedRoutes = new Set([
  "admin",
  "api",
  "bang-gia",
  "books",
  "dashboard",
  "dang-ky",
  "dang-nhap",
  "docs",
  "e",
  "iot-developer",
  "linh-kien",
  "san-pham",
  "status",
  "tao-show",
  "thanh-toan-demo",
  "thue-api",
  "thue-thiet-bi"
]);

export default async function CmsLandingPage({ params }: { params: { slug: string } }) {
  if (reservedRoutes.has(params.slug)) notFound();
  const page = await api<StaticPage>(`/cms/pages/${encodeURIComponent(params.slug)}`, { cache: "no-store" }).catch(() => null);
  if (!page) notFound();
  return <StaticPageRenderer page={page} />;
}
