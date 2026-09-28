import { notFound } from "next/navigation";
import { StaticPageRenderer } from "@/components/static-page-renderer";
import { api, type StaticPage } from "@/lib/api";

export async function renderStaticPage(slug: string) {
  const page = await api<StaticPage>(`/cms/pages/${encodeURIComponent(slug)}`, { cache: "no-store" }).catch(() => null);
  if (!page) notFound();
  return <StaticPageRenderer page={page} />;
}
