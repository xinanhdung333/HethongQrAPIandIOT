import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/reveal";
import type { StaticPage } from "@/lib/api";

type SectionItem = NonNullable<StaticPage["sections"][number]["items"]>[number];

function safeHeroImage(src: string) {
  if (!src) return "";
  return src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/") ? src : "";
}

function CtaLink({ cta, variant = "primary" }: { cta?: { label: string; href: string } | null; variant?: "primary" | "secondary" }) {
  if (!cta?.label || !cta.href) return null;
  return (
    <Link
      href={cta.href}
      className={variant === "primary" ? "btn btn-primary focus-ring" : "btn btn-secondary focus-ring bg-white/85"}
    >
      {cta.label}
      {variant === "primary" && <ArrowRight size={16} />}
    </Link>
  );
}

function ItemCard({ item, pricing = false }: { item: SectionItem; pricing?: boolean }) {
  const content = (
    <article className="panel h-full p-6 transition duration-200 hover:-translate-y-1 hover:shadow-sm">
      {pricing && item.price && <p className="text-3xl font-semibold tracking-tight">{item.price}</p>}
      <h3 className={`${pricing ? "mt-4" : ""} text-xl font-semibold tracking-tight`}>{item.title}</h3>
      {item.value && <p className="mt-4 text-4xl font-semibold tracking-tight">{item.value}</p>}
      {item.label && <p className="mt-2 text-sm font-medium text-zinc-500">{item.label}</p>}
      {item.body && <p className="mt-3 text-sm leading-6 text-zinc-600">{item.body}</p>}
    </article>
  );

  return item.href ? <Link href={item.href}>{content}</Link> : content;
}

export function StaticPageRenderer({ page }: { page: StaticPage }) {
  const heroImage = safeHeroImage(page.heroImage);

  return (
    <main>
      <section className="relative isolate min-h-[520px] overflow-hidden border-b border-zinc-200 bg-zinc-950 text-white">
        {heroImage && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-45"
            style={{ backgroundImage: `url("${heroImage}")` }}
            aria-hidden="true"
          />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,9,11,0.92),rgba(9,9,11,0.58),rgba(9,9,11,0.3))]" aria-hidden="true" />
        <div className="shell relative flex min-h-[520px] items-center py-24 md:py-32">
          <Reveal className="max-w-3xl">
            <p className="text-sm font-medium text-zinc-300">{page.navLabel}</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">{page.title}</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-200 md:text-lg">{page.description}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <CtaLink cta={page.ctaPrimary} />
              <CtaLink cta={page.ctaSecondary} variant="secondary" />
            </div>
          </Reveal>
        </div>
      </section>

      {page.sections.map((section, index) => {
        const isBand = section.kind === "band";
        const isDark = isBand && index % 2 === 0;
        return (
          <section key={`${section.kind}-${section.title}-${index}`} className={`${isDark ? "bg-zinc-950 text-zinc-100" : "bg-white text-zinc-950"} ${isBand ? "border-y border-zinc-200" : ""}`}>
            <div className="shell py-20 md:py-28">
              <Reveal>
                <div className="max-w-3xl">
                  <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">{section.title}</h2>
                  {section.subtitle && <p className={`mt-4 text-base leading-7 ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{section.subtitle}</p>}
                  {section.body && <p className={`mt-4 text-base leading-7 ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{section.body}</p>}
                </div>
              </Reveal>

              {section.items?.length ? (
                <Reveal className={`mt-10 grid gap-6 ${section.kind === "stats" ? "md:grid-cols-3" : section.kind === "timeline" ? "md:grid-cols-3" : "lg:grid-cols-3"}`}>
                  {section.items.map((item, itemIndex) => (
                    <ItemCard key={`${item.title ?? item.label ?? itemIndex}-${itemIndex}`} item={item} pricing={section.kind === "pricing"} />
                  ))}
                </Reveal>
              ) : null}
            </div>
          </section>
        );
      })}
    </main>
  );
}
