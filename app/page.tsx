import Link from "next/link";
import Directory from "@/components/Directory";
import { TOOLS } from "@/lib/tools";

export default function Home() {
  const featured = TOOLS.filter((t) => t.featured);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20">
      {/* Hero */}
      <section className="py-14 text-center sm:py-20">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-emerald-400">
          {TOOLS.length} verified AI deals · updated weekly
        </p>
        <h1 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          Free credits & deals on the <span className="text-emerald-400">best AI tools</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm text-neutral-400 sm:text-base">
          Every working offer in one place — $100 cloud credits, free student plans, and discounts on
          chatbots, coding tools, and APIs.
        </p>
      </section>

      {/* Featured */}
      <section className="mb-14">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Featured deals</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((t) => (
            <Link
              key={t.slug}
              href={`/offer/${t.slug}`}
              className="group relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-emerald-500/10 to-transparent p-5 transition-colors hover:border-emerald-400/50"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-neutral-900 text-2xl ring-1 ring-neutral-800">
                  {t.emoji}
                </span>
                <div>
                  <h3 className="font-semibold leading-tight">{t.name}</h3>
                  <p className="text-xs text-neutral-500">{t.category}</p>
                </div>
              </div>
              <p className="mt-3 text-sm font-medium text-emerald-300">{t.offer}</p>
              <p className="mt-1 text-xs text-neutral-400 line-clamp-2">{t.description}</p>
              <span className="mt-4 inline-block text-xs font-semibold text-emerald-400">
                Claim deal →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Directory */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">All deals</h2>
        <Directory tools={TOOLS} />
      </section>
    </div>
  );
}
