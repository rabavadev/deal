# 📡 Deal — AI Tool Offers & Free Credits

A curated directory of AI tool deals: free credits, student plans, and discounts —
with affiliate links on every offer. Built with Next.js 16 + Tailwind CSS v4.
Fully static, deploys free on Vercel in one click.

## Structure

- `lib/tools.ts` — **the only file you need to edit.** Every deal lives here.
- `app/page.tsx` — homepage (hero, featured deals, searchable directory)
- `app/offer/[slug]/page.tsx` — one SEO-friendly page per deal
- `components/` — `Directory` (search + filters) and `ToolCard`

## Adding / editing a deal

Open `lib/tools.ts` and copy an existing entry:

```ts
{
  slug: "my-tool",                    // becomes /offer/my-tool
  name: "My Tool",
  emoji: "🚀",
  tagline: "One-line description",
  offer: "Free $100 credits on signup",
  offerValue: "$100 free",            // green badge on the card
  category: "APIs & Credits",         // must be one of CATEGORIES
  featured: true,                     // shows in the Featured section
  affiliateUrl: "https://YOUR-AFFILIATE-LINK",  // ← put your affiliate link here
  description: "What the tool does and what the deal includes.",
  steps: ["Sign up", "Verify", "Claim the credit"],
  terms: "Optional fine print.",
}
```

Every entry has `// TODO: replace with your affiliate link` — search the file for
`TODO` and swap in your real affiliate URLs.

Categories are defined in `CATEGORIES` at the top of `lib/tools.ts`.
Add one there and it's automatically available on the homepage filters.

## Develop

```bash
bun install   # or npm install
bun dev       # http://localhost:3000
```

## Deploy

Push to GitHub, then import the repo at [vercel.com/new](https://vercel.com/new) —
no configuration needed (no env vars, no database). Or run:

```bash
bunx vercel --prod
```

---

*Forked from [deal-radar](https://github.com/ozansozuozgit/deal-radar) (MIT) and
repurposed from a grocery deals aggregator into an AI tools offers directory.*
