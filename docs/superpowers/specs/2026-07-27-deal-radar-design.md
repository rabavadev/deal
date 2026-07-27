# Deal Radar — Design Spec

**Date:** 2026-07-27
**Status:** Draft for user review
**Owner:** Ozan

## What it is

A web app that shows the best current supermarket deals near a saved address, within a
customizable radius. Personal tool first (optimized for the Upper East Side, NYC (zip 10128)),
architected so it could open to other users later.

Prior attempts (`grocery-ai-deals`, `grocery-data`) failed because they scraped each store's
website generically and hit interactive PDF/flip-book viewers. This design reads structured
data feeds instead — no Firecrawl, no paid scraping APIs.

## Data sources (verified working 2026-07-27)

### 1. Flipp (covers ~30 grocery chains near 10128)

Unofficial but stable JSON API used by the Flipp app itself:

- `GET https://backflipp.wishabi.com/flipp/flyers?locale=en-us&postal_code={zip}`
  → all active flyers with `merchant`, `name`, `valid_from`, `valid_to`, `categories`.
  Filter to `categories` containing `Groceries`.
- `GET https://backflipp.wishabi.com/flipp/flyers/{flyer_id}/flyer_items`
  → every item in a flyer: name, current/original price, sale story, image, validity.
- `GET https://backflipp.wishabi.com/flipp/items/search?locale=en-us&postal_code={zip}&q={query}`
  → cross-merchant item search (used server-side as a fallback for search).

Verified for 10128: 79 flyers, ~30 grocery (Morton Williams, Stop & Shop, C-Town, Aldi, Lidl,
H Mart, Met Foods, Western Beef, Target, Walmart, Wegman's, Key Food banners, etc.).
Aldi showed two simultaneous flyers (current week + next week) — see "Flyer lifecycle".

### 2. Whole Foods (not on Flipp)

`https://www.wholefoodsmarket.com/sales-flyer?store-id={id}` server-renders the full weekly
sales list per store (item name, Prime price, non-Prime price, regular price, % off, expiry).
Supporting JSON endpoints observed: `/api/stores/{id}/summary`, `/api/wwos/products?asins=…`.

- Adapter: fetch the sales-flyer page for the Upper East Side store (find store id via the
  stores API during implementation; 10713 = Manhattan West was the IP-based default),
  parse the embedded server-rendered data (Next.js payload / DOM).
- Amazon bot protection blocks naive `curl`; the ingestion job therefore runs headless
  Chromium (Playwright) — see "Ingestion architecture".
- Both Prime and non-Prime prices are stored and shown.

### 3. Fairway (not on Flipp; the flip-book that motivated this project)

Fairway's circular is a RedPepper Digital publication (client id 4650; iframe found at
`fairwaymarket.com/sm/planning/rsid/4000/circulars`). RedPepper exposes clean JSON at
`node.redpepper.digital`:

- `GET /client/4650/catalogues/json?_format=json` → current catalogues with `nid_1`
  (catalogue id), title, `start`/`finish` dates, cover image.
- `GET /rpms_catalogue/{catalogue_id}/page/0/{last}/regions` → per-page product regions:
  `field_product_title`, `field_product_description`, percent-based `coords` on the page
  image, product image URL. **No prices in metadata** (verified: 102 regions, 0 with price).
- `GET /catalogue/{catalogue_id}/page-images/json` → page JPEG URLs (CloudFront).
- `GET /catalogue/{id}/page/0/{last}/region/alllightbox` → region → SKU list mapping.

Price strategy for Fairway, in order:
1. **Image-crop display (no extraction):** each region's `coords` give its rectangle on the
   page image; the UI shows the cropped flyer snippet, which contains the printed price.
   Always accurate, zero extraction risk. This ships in Phase 1.
2. **Numeric price extraction (Phase 2, for search/compare/history):** resolve region SKUs
   against Fairway's own Mi9 e-commerce API for current prices, falling back to a free-tier
   Gemini vision pass over the ~8 page images weekly (trivial volume, $0). If both fail,
   Fairway items simply lack numeric prices and are excluded from numeric-only features.

### Source adapter contract

Each source implements one interface so new stores can be added without touching the rest:

```ts
interface DealSource {
  id: string;                          // 'flipp' | 'wholefoods' | 'fairway' | …
  fetchFlyers(loc: Location): Promise<Flyer[]>;   // flyer metadata + validity
  fetchDeals(flyer: Flyer): Promise<Deal[]>;      // items for one flyer
}
```

## Flyer lifecycle (the "two flyers" problem)

Observed reality: a store can have several flyers live at once — this week's ad, next week's
ad (published early), long-running "monthly savings" books, and near-permanent inserts.

Rules:
- Every flyer is stored with `valid_from` / `valid_to`; nothing is guessed.
- A deal is **active** when `now ∈ [valid_from, valid_to]`; **upcoming** when
  `valid_from > now` (badged "Starts Wed"); expired deals leave the feed automatically but
  stay in the DB as history.
- Re-ingesting the same flyer upserts by `(source, external_flyer_id)` — no duplicates.
- Pagination is the source API's problem, not a UI-driven one: Flipp returns complete item
  arrays; RedPepper regions are fetched for all pages (`page/0/{last}`); Whole Foods renders
  the full list. "Are there more pages?" ambiguity disappears because we never drive a
  viewer UI.

## Ingestion architecture

**GitHub Actions scheduled workflow (free), daily at ~06:00 ET**, because store cycles differ
(Whole Foods Wed–Tue, Fairway Thu–Wed, others Sun/Mon starts) and because Actions can run
Playwright for the Whole Foods fetch — Vercel serverless cannot comfortably. A `workflow_dispatch`
trigger plus a "Refresh now" button in the app (calls a GitHub API dispatch via a server route)
covers manual refreshes.

Each run: for each configured location (initially one: 10128) → for each adapter →
fetch flyers → fetch deals → upsert into Postgres. A run summary row (per source: flyer count,
item count, errors) powers a small freshness/health indicator in the UI footer.

## Data model (Supabase Postgres, free tier)

- `stores` — id, source, merchant name, branch address, lat/lng, logo.
  Branch locations for radius filtering come from OpenStreetMap Overpass (free) matched by
  merchant name near the saved address, cached in this table.
- `flyers` — id, store/merchant ref, source, external_id, title, valid_from, valid_to,
  first_seen, last_seen.
- `deals` — id, flyer ref, name, normalized_name (for cross-week identity), description,
  size text, price numeric (nullable — Fairway), original_price, unit ('ea'/'lb'),
  prime_price (Whole Foods), discount_pct (computed), category, image_url,
  crop (page image URL + rect, Fairway), valid_from/to (denormalized).
- `ingest_runs` — per-source counts + errors per run.
- Phase 2 tables: `list_items` (shopping list), `watches` (alert rules), price history is
  just `deals` over time via `normalized_name`.

Categories: assigned by keyword rules over item names (produce/meat/seafood/dairy/pantry/
frozen/beverages/household/other) — no LLM needed; Flipp also supplies category hints.

## Web app (Next.js on Vercel, free tier)

Single-page app, mobile-first (used in-store on a phone).

- **Setup (first visit):** address input (geocoded via free US Census geocoder) or browser
  geolocation; radius slider 0.5–10 mi (Manhattan-appropriate, default 1.5 mi); store
  checklist auto-populated from data within radius. Saved locally (localStorage) — no
  accounts in Phase 1.
- **Top Deals feed:** combined, active-only, sorted by discount % (deals without numeric
  prices sort by store prominence and show their flyer crop); filter chips per store and
  category; "upcoming" toggle showing next week's flyers.
- **Search:** substring + fuzzy match over active deals ("chicken" → all chicken deals,
  cheapest first, unit prices shown when parseable).
- **Deal card:** product image (or Fairway flyer crop), price, original price + % off,
  store name + distance, days left ("ends Tue").
- **Phase 2 — Shopping list:** add items (free text matched against active deals); per-store
  totals for matched items; "best single store" and "best 2-store split" summaries.
- **Phase 2 — History & alerts:** price timeline on a deal card (same normalized item across
  weeks); watched items ("alert me when chicken breast < $2.99/lb") surfaced in-app as a
  "Your watches" section; email alerts optional later (Resend free tier) — not in scope now.

## Costs & constraints

- $0/month: Vercel free, Supabase free, GitHub Actions free, Census geocoder free,
  Overpass free, unofficial APIs free. No Firecrawl, no paid LLM APIs.
- Unofficial APIs (Flipp, RedPepper, Whole Foods page) can change or rate-limit; the adapter
  boundary isolates each. Ingestion is 1 request/flyer/day — negligible load. If this ever
  goes public, revisit terms-of-service exposure per source.
- Old repos' leaked keys (Google Maps, Firecrawl, Gemini in `grocery-ai-deals/PROJECT_DESCRIPTION.md`)
  should be revoked; this project uses none of them.

## Error handling

- One source failing must not block others; failures are recorded in `ingest_runs` and shown
  as "Whole Foods data is from Jul 24" style staleness notes per store.
- Geocoding failure → clear inline error, keep last saved location.
- Deals with unparseable prices are kept (displayed with their raw price text / crop) but
  excluded from numeric sorts and comparisons.

## Testing

- Unit: price-text parser ("2/$5", "$3.99/lb", "B1G1 50% off"), category rules,
  active/upcoming logic, upsert idempotency (fixtures of captured API responses).
- Adapter integration tests run against recorded fixtures; a separate live smoke test
  (manually triggered) validates the three sources still respond as expected.
- E2E: Playwright against the running app — setup flow, feed renders, search, filters.
- Real-build verification per operating practices: deploy, run a real ingest for 10128,
  confirm deals from all three sources render with correct prices vs. the stores' own flyers.

## Phases

1. **MVP:** adapters (Flipp, Whole Foods, Fairway-with-crops), daily ingest, setup flow,
   Top Deals feed, search. Deployed and verified for 10128.
2. **Compare & history:** Fairway numeric prices, shopping-list comparison, price history
   timelines, in-app watches.
