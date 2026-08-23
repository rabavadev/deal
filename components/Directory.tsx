"use client";

import { useMemo, useState } from "react";
import { CATEGORIES, type Tool } from "@/lib/tools";
import ToolCard from "./ToolCard";

export default function Directory({ tools }: { tools: Tool[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tools.filter((t) => {
      const inCategory = category === "All" || t.category === category;
      if (!inCategory) return false;
      if (!q) return true;
      return [t.name, t.tagline, t.offer, t.category]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [tools, query, category]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tools) map.set(t.category, (map.get(t.category) ?? 0) + 1);
    return map;
  }, [tools]);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500">
          ⌕
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tools, offers, credits…"
          className="w-full rounded-xl border border-neutral-800 bg-neutral-900 py-3 pl-10 pr-4 text-sm outline-none placeholder:text-neutral-500 focus:border-emerald-500/60"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {["All", ...CATEGORIES].map((c) => {
          const active = category === c;
          const count = c === "All" ? tools.length : counts.get(c) ?? 0;
          return (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-emerald-500 text-neutral-950"
                  : "border border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-600"
              }`}
            >
              {c} <span className={active ? "opacity-70" : "text-neutral-500"}>{count}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-neutral-500">
          No deals match “{query}”. Try another search.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <ToolCard key={t.slug} tool={t} />
          ))}
        </div>
      )}
    </div>
  );
}
