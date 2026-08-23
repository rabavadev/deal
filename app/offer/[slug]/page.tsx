import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TOOLS, getTool } from "@/lib/tools";

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
  return {
    title: `${tool.name} — ${tool.offerValue ?? "Deal"}`,
    description: tool.description,
  };
}

export default async function OfferPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
        ← All deals
      </Link>

      <div className="mt-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-neutral-900 text-3xl ring-1 ring-neutral-800">
            {tool.emoji}
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{tool.name}</h1>
            <p className="text-sm text-neutral-500">
              {tool.tagline} · {tool.category}
            </p>
          </div>
        </div>
        {tool.offerValue && (
          <span className="shrink-0 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
            {tool.offerValue}
          </span>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-6">
        <p className="text-xs font-medium uppercase tracking-widest text-emerald-400">The deal</p>
        <p className="mt-2 text-lg font-semibold">{tool.offer}</p>
        <p className="mt-3 text-sm leading-relaxed text-neutral-300">{tool.description}</p>
        <a
          href={tool.affiliateUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-neutral-950 transition-colors hover:bg-emerald-400 sm:w-auto"
        >
          Claim this deal →
        </a>
        <p className="mt-3 text-[11px] text-neutral-500">
          Affiliate link — supports this site at no extra cost to you.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-400">
          How to claim
        </h2>
        <ol className="mt-4 flex flex-col gap-3">
          {tool.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-neutral-200">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-neutral-800 text-xs font-semibold text-emerald-300">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        {tool.terms && (
          <p className="mt-5 border-t border-neutral-800 pt-4 text-xs text-neutral-500">
            Terms: {tool.terms}
          </p>
        )}
      </div>
    </div>
  );
}
