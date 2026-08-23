import Link from "next/link";
import {
  OFFER_TYPE_STYLES,
  offerType,
  toolRegion,
  toolTags,
  type Tool,
} from "@/lib/tools";

export function OfferBanner({ tool, className = "" }: { tool: Tool; className?: string }) {
  return (
    <div
      className={`flex h-12 items-center rounded-lg border px-3 py-1 text-sm font-semibold ${OFFER_TYPE_STYLES[offerType(tool)]} ${className}`}
    >
      <p className="line-clamp-2 leading-tight">{tool.offer}</p>
    </div>
  );
}

export function RegionPill({ tool }: { tool: Tool }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-2.5 py-0.5 text-xs font-medium text-foreground">
      <svg className="mr-1.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
        <circle cx="12" cy="10" r="3" />
      </svg>
      {toolRegion(tool)}
    </span>
  );
}

export function TagPills({ tool }: { tool: Tool }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {toolTags(tool).map((tag) => (
        <span
          key={tag}
          className="inline-flex shrink-0 items-center rounded-full border border-primary/30 bg-primary/25 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

export default function OfferCard({ tool }: { tool: Tool }) {
  return (
    <div className="group/card relative flex h-full cursor-pointer flex-col rounded-2xl border border-border bg-card shadow-md transition-all duration-200 hover:z-30 hover:-translate-y-1 hover:border-primary/50 hover:bg-primary/5 hover:shadow-xl">
      {/* stretched link */}
      <Link href={`/offer/${tool.slug}`} className="absolute inset-0 z-0 rounded-2xl" aria-label={tool.name} />

      {/* header */}
      <div className="flex items-start gap-3 p-4 pb-0">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-muted text-2xl">
          {tool.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold leading-tight">{tool.name}</h3>
          <div className="mt-1.5">
            <TagPills tool={tool} />
          </div>
        </div>
        <span className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground opacity-80 transition-all hover:text-red-500 hover:opacity-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 1 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
          </svg>
        </span>
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-2">
        <OfferBanner tool={tool} />
        <div className="min-h-[40px] flex-grow">
          <p className="line-clamp-2 text-left text-sm text-muted-foreground">{tool.tagline} — {tool.description}</p>
        </div>
        <div className="relative z-10">
          <a
            href={tool.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="group flex w-full items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.96]"
          >
            Claim Offer
            <svg className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 7h10v10" />
              <path d="M7 17 17 7" />
            </svg>
          </a>
        </div>
      </div>

      {/* footer */}
      <div className="flex items-center justify-center border-t border-white/20 px-4 py-2">
        <RegionPill tool={tool} />
      </div>
    </div>
  );
}
