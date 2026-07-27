# Deal Radar — Phase 2 Design (features + user journey)

**Date:** 2026-07-27 · **Builds on:** `2026-07-27-deal-radar-design.md` (Phase 1, shipped)

Goal: make the whole journey effortless and impressive — from first visit to weekly use —
and ship the Phase 2 features (list comparison, price history, watches, Fairway prices).

## User journey upgrades

1. **Address autocomplete + one-tap location.** Setup screen gets live address
   suggestions as you type (Photon, the free OSM geocoder — no key, supports
   autocomplete) plus a "Use my location" button (browser geolocation → Photon
   reverse-geocode). Falls back to the existing Census geocoder on submit.
2. **Images everywhere.**
   - Flipp deals already have product cutout photos.
   - Whole Foods: the sales-flyer page fetches product JSON (`/api/wwos/products`)
     containing images and exact prices; the Playwright fetcher now intercepts those
     responses and enriches parsed deals by name-matching → real product photos.
   - Fairway keeps its flyer crops (the printed price is the image).
   - Store logos: Flipp flyers carry `merchant_logo`; store sync saves them and the UI
     shows logos in store chips and on deal cards.
3. **Feed polish.** Skeleton loading cards, deal-count header, sort control
   (Biggest discount / Lowest price / Ending soon), category chips with emoji,
   friendly empty states, safe-area padding.
4. **Deal detail sheet.** Tapping a card opens a bottom sheet: large image/crop,
   full pricing, days left, price-history sparkline (data accumulates weekly),
   "Watch this item" and "Add to list" actions.
5. **Installable.** Web-app manifest + icons so "Add to Home Screen" gives an
   app-like fullscreen experience on the phone.

## Phase 2 features

- **Shopping list.** Stored in localStorage (no accounts). Add items free-text from a
  list tab or straight from a deal card. The list view matches items against active
  deals (token match on `normalized_name`), shows the best price per item, per-store
  totals over matched items, and a summary: best single store and best 2-store split.
- **Price history.** `GET /api/history?name=<normalized>&store=<slug>` returns that
  item's price points across weeks (from accumulated `deals` rows). Shown as a
  sparkline in the detail sheet. (Only grows richer over time; one point today.)
- **Watches.** localStorage list of `{term, maxPrice?}`. A "Watching" rail at the top
  of the feed shows current matches (term match against active deals, filtered by
  maxPrice when set) with a subtle highlight when something matches. No email — in-app
  only, personal tool.
- **Fairway numeric prices (optional, env-gated).** In the daily ingest, if
  `GEMINI_API_KEY` is set, send each Fairway page image once to Gemini Flash (free
  tier; ~7 images/week) to extract `{title → price}` pairs, matched back to regions by
  title similarity; parsed prices fill `deals.price` so Fairway joins numeric sorting
  and list comparison. Without the key, Fairway stays crop-only (current behavior).
  No paid usage ever; the key is optional and free-tier.

## Non-goals (unchanged)

Accounts, email/push notifications, multi-city support, public launch hardening.

## Data changes

- `stores.logo_url` populated from Flipp `merchant_logo` (column already exists).
- No schema migrations required; history and watches read existing tables.
