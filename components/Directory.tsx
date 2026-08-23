"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CATEGORIES, OFFER_TYPE_STYLES, offerType, toolRegion, type Tool } from "@/lib/tools";
import OfferCard, { OfferBanner, RegionPill, TagPills } from "./OfferCard";
import Link from "next/link";

const PER_PAGE_OPTIONS = [12, 24, 48];
const SORTS = ["Newest", "Oldest", "Name A-Z"] as const;

export default function Directory({ tools }: { tools: Tool[] }) {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";

  const [category, setCategory] = useState<string>("All");
  const [sort, setSort] = useState<(typeof SORTS)[number]>("Newest");
  const [perPage, setPerPage] = useState(24);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = tools.filter((t) => {
      if (category !== "All" && t.category !== category) return false;
      if (!q) return true;
      return [t.name, t.tagline, t.offer, t.category, t.description]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
    if (sort === "Oldest") list = [...list].reverse();
    if (sort === "Name A-Z") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [tools, query, category, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * perPage, current * perPage);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tools) m.set(t.category, (m.get(t.category) ?? 0) + 1);
    return m;
  }, [tools]);

  return (
    <div>
      {/* category pills */}
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 pt-4">
        {["All", ...CATEGORIES].map((c) => {
          const active = category === c;
          return (
            <button
              key={c}
              onClick={() => {
                setCategory(c);
                setPage(1);
              }}
              className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground/80 hover:border-primary/50"
              }`}
            >
              {c === "All" ? "All Tools" : c}
            </button>
          );
        })}
      </div>

      {/* title row */}
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {category === "All" ? "All Tools" : category}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Showing {filtered.length} offers</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as (typeof SORTS)[number])}
            className="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none"
          >
            {SORTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value));
              setPage(1);
            }}
            className="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none"
          >
            {PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <div className="flex overflow-hidden rounded-lg border border-border">
            <button
              aria-label="Grid view"
              onClick={() => setView("grid")}
              className={`grid h-9 w-9 place-items-center ${view === "grid" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
            </button>
            <button
              aria-label="List view"
              onClick={() => setView("list")}
              className={`grid h-9 w-9 place-items-center ${view === "list" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* offers */}
      {visible.length === 0 ? (
        <p className="py-20 text-center text-sm text-muted-foreground">
          No offers match “{query}”.
        </p>
      ) : view === "grid" ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => (
            <OfferCard key={t.slug} tool={t} />
          ))}
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {visible.map((t) => (
            <ListRow key={t.slug} tool={t} />
          ))}
        </div>
      )}

      {/* pagination */}
      {pageCount > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-2">
          <button
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
            className="flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm disabled:opacity-40"
          >
            ‹ Previous
          </button>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={`h-9 w-9 rounded-lg border text-sm font-medium ${
                n === current
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              {n}
            </button>
          ))}
          <button
            disabled={current === pageCount}
            onClick={() => setPage(current + 1)}
            className="flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm disabled:opacity-40"
          >
            Next ›
          </button>
        </nav>
      )}
    </div>
  );
}

function ListRow({ tool }: { tool: Tool }) {
  return (
    <div className="relative flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-primary/5">
      <Link href={`/offer/${tool.slug}`} className="absolute inset-0 rounded-xl" aria-label={tool.name} />
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-muted text-2xl">
        {tool.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-[15px] font-semibold">{tool.name}</h3>
          <div className="hidden sm:block">
            <TagPills tool={tool} />
          </div>
        </div>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{tool.tagline}</p>
      </div>
      <div className={`hidden w-64 shrink-0 rounded-lg border px-3 py-1.5 text-sm font-semibold md:block ${OFFER_TYPE_STYLES[offerType(tool)]}`}>
        <p className="truncate">{tool.offer}</p>
      </div>
      <a
        href={tool.affiliateUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="relative z-10 flex shrink-0 items-center gap-1.5 rounded-lg border border-primary bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Claim
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 7h10v10" /><path d="M7 17 17 7" /></svg>
      </a>
    </div>
  );
}
