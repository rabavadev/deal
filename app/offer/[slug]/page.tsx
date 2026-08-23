import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  OFFER_TYPE_STYLES,
  TOOLS,
  getTool,
  offerType,
  toolsByCategory,
} from "@/lib/tools";
import { RegionPill, TagPills } from "@/components/OfferCard";

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return {};
  return { title: `${tool.name} — ${tool.offer}`, description: tool.description };
}

export default async function OfferPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();

  const related = toolsByCategory(tool.category)
    .filter((t) => t.slug !== tool.slug)
    .slice(0, 4);

  const notes = [
    ...tool.steps,
    ...(tool.terms ? [`Terms: ${tool.terms}`] : []),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_360px]">
        {/* main column */}
        <div>
          <span className="grid h-20 w-20 place-items-center rounded-2xl bg-primary text-4xl text-primary-foreground">
            {tool.emoji}
          </span>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground/80">
              {tool.category}
            </span>
            <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground/80">
              {tool.tagline}
            </span>
          </div>

          <h1 className="mt-4 font-serif text-4xl font-bold tracking-tight sm:text-5xl">
            {tool.name}
          </h1>

          <div
            className={`mt-5 inline-block rounded-lg border px-4 py-2 text-base font-semibold ${OFFER_TYPE_STYLES[offerType(tool)]}`}
          >
            {tool.offer}
          </div>

          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            {tool.description}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <RegionPill tool={tool} />
            <TagPills tool={tool} />
          </div>

          <h2 className="mt-10 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Important Notes
          </h2>
          <div className="mt-4 flex flex-col gap-3">
            {notes.map((note, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-sm leading-relaxed"
              >
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {note}
              </div>
            ))}
          </div>
        </div>

        {/* sidebar */}
        <aside className="flex flex-col gap-5">
          {tool.featured && (
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/15 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-violet-300">
                ✨ Featured Deal
              </p>
              <p className="mt-1 text-xs text-violet-200/70">
                A curated pick our team loves.
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              What you get
            </p>
            <p className="mt-2 font-serif text-2xl font-semibold leading-snug">{tool.offer}</p>
            <a
              href={tool.affiliateUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-primary bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Claim
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 7h10v10" />
                <path d="M7 17 17 7" />
              </svg>
            </a>
            <Link
              href="/"
              className="mt-3 flex w-full items-center justify-center rounded-lg border border-border py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted"
            >
              Browse all offers
            </Link>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Affiliate link — supports this site at no extra cost to you.
            </p>
          </div>

          {related.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                More in this category
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/offer/${r.slug}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/50"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-lg">
                      {r.emoji}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{r.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.offer}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
