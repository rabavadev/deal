export type Tool = {
  slug: string;
  name: string;
  emoji: string;
  tagline: string;
  offer: string;
  offerValue?: string; // short badge like "$100 free"
  category: Category;
  featured?: boolean;
  /** REPLACE THIS with your affiliate link */
  affiliateUrl: string;
  description: string;
  steps: string[];
  terms?: string;
};

export const CATEGORIES = [
  "AI Chatbots",
  "AI Coding",
  "Image & Video",
  "Audio & Music",
  "APIs & Credits",
  "Productivity",
] as const;

export type Category = (typeof CATEGORIES)[number];

// ── Data source ──────────────────────────────────────────────────
// All deals live in lib/tools-data.json. Edit them from the /admin
// panel (commits to GitHub) or by hand here.
import toolsData from "./tools-data.json";

export const TOOLS: Tool[] = toolsData as Tool[];

export function getTool(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

export function toolsByCategory(category: Category): Tool[] {
  return TOOLS.filter((t) => t.category === category);
}

/* ── Display derivations (reference-site card model) ───────────── */

export type OfferType = "credit" | "discount" | "free";

export function offerType(t: Tool): OfferType {
  const s = t.offer.toLowerCase();
  if (s.includes("%") || s.includes(" off")) return "discount";
  if (s.includes("$") || s.includes("credit")) return "credit";
  return "free";
}

export const OFFER_TYPE_STYLES: Record<OfferType, string> = {
  credit:
    "bg-violet-500/25 text-violet-300 border-violet-500/40",
  discount:
    "bg-amber-500/25 text-amber-300 border-amber-500/40",
  free:
    "bg-green-500/25 text-green-300 border-green-500/40",
};

export function toolTags(t: Tool): string[] {
  const tags = new Set<string>();
  const s = (t.offer + " " + t.tagline + " " + t.category).toLowerCase();
  if (s.includes("credit") || s.includes("$")) tags.add("Credit");
  if (s.includes("api")) tags.add("API");
  if (s.includes("%") || s.includes(" off")) tags.add("Discount");
  if (s.includes("free")) tags.add("Free");
  if (s.includes("student")) tags.add("Student");
  if (t.category === "AI Coding") tags.add("Developer");
  if (t.featured) tags.add("Featured");
  return [...tags].slice(0, 3);
}

export function toolRegion(_t: Tool): string {
  return "Global";
}
