import Link from "next/link";
import type { Tool } from "@/lib/tools";

export default function ToolCard({ tool }: { tool: Tool }) {
  return (
    <Link
      href={`/offer/${tool.slug}`}
      className="group flex flex-col gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 transition-colors hover:border-neutral-600"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-neutral-800 text-xl">
            {tool.emoji}
          </span>
          <div>
            <h3 className="font-semibold leading-tight group-hover:text-emerald-300 transition-colors">
              {tool.name}
            </h3>
            <p className="text-xs text-neutral-500">{tool.tagline}</p>
          </div>
        </div>
        {tool.offerValue && (
          <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 ring-1 ring-emerald-500/30">
            {tool.offerValue}
          </span>
        )}
      </div>
      <p className="text-sm text-neutral-300">{tool.offer}</p>
      <div className="mt-auto flex items-center justify-between pt-1">
        <span className="text-xs text-neutral-500">{tool.category}</span>
        <span className="text-xs font-medium text-emerald-400 opacity-0 transition-opacity group-hover:opacity-100">
          View deal →
        </span>
      </div>
    </Link>
  );
}
