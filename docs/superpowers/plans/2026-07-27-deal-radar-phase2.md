# Deal Radar Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Phase 2 features (shopping-list comparison, price history, watches, optional Fairway numeric prices) and a full user-journey upgrade (address autocomplete, geolocation, product images, store logos, detail sheet, sort, skeletons, PWA install).

**Architecture:** No schema changes. New read endpoints (`/api/history`, `/api/suggest`); ingest enrichments (store logos from Flipp, Whole Foods images/prices via response interception, env-gated Gemini extraction for Fairway); client-side list/watches in localStorage.

**Tech Stack:** unchanged (Next 16, Supabase, Playwright, vitest). Photon (komoot) for autocomplete — free, no key.

## Global Constraints

- Everything from Phase 1 (no paid APIs; Gemini key optional and free-tier only; tests offline via fixtures; mobile-first).
- localStorage only for list/watches — no accounts.
- Each task ends green (`npm test`, `npm run build`) and committed.

### Task 1: Store logos
- `mapFlippFlyers` carries `logoUrl` (from `merchant_logo`); `FlyerInput` gains optional `logoUrl`; `syncStores` upserts `logo_url` (nearest-branch match unchanged); `/api/meta` returns it. UI: logo in store chips + tiny logo on cards.

### Task 2: Whole Foods images + exact prices
- In `wholeFoodsSource.fetchDeals`, collect JSON bodies of responses matching `/api/wwos/products`; save one capture to `fixtures/wholefoods-products.json` during implementation.
- New pure fn `enrichWfDeals(deals, products)` in `wholefoods-parse.ts`: match product entries to parsed deals by normalized-name token overlap; fill `imageUrl` (and `price` only when the deal's own parse lacked one). Test against fixtures.

### Task 3: Address autocomplete + geolocation
- `app/api/suggest/route.ts`: proxy `https://photon.komoot.io/api?q=&limit=5&lat=&lon=` → `[{label, lat, lng, zip?}]` (label from name/street/housenumber/city/postcode; US-biased via lat/lon of NYC).
- `SetupCard`: debounced suggestions dropdown (keyboard + tap), "📍 Use my location" button → `navigator.geolocation` → Photon reverse (`/reverse?lat=&lon=`) → fills address+zip. Census fallback stays for manual submit.

### Task 4: Feed polish
- Sort select (discount | price | ending-soon) — `sort=ending` added to `/api/deals` (order by `valid_to` asc).
- Skeleton cards while loading; "N deals" count line; emoji category chips (🥬🥩🐟🥛🥐🧊🥤🥫🍿🧻🧴); store chips with logos; better empty state; `env(safe-area-inset-bottom)` padding.

### Task 5: Detail sheet + price history
- `app/api/history/route.ts`: `?name=<normalized_name>&store=<slug>` → `[{valid_from, valid_to, price, original_price}]` ordered by `valid_from` (distinct flyer weeks).
- `components/DealSheet.tsx`: bottom sheet (fixed inset-x-0 bottom-0, backdrop) with large image/crop, prices, days-left, sparkline (inline SVG polyline — no chart lib), Watch + Add-to-list buttons.

### Task 6: Watches
- `lib/client/watches.ts` (localStorage CRUD: `{term, maxPrice?}`), "Watching" rail in Feed: for each watch, cheapest current match (client-side filter of a `/api/deals?q=term` fetch); manage (add from sheet/search, remove chip).

### Task 7: Shopping list + comparison
- `lib/client/list.ts` (localStorage items: `{text}`), `lib/compare.ts` pure: given list items + active deals → per-item best match per store (token match on normalized_name), per-store totals over matched items, best single store, best 2-store split (brute-force pairs, small N). Vitest for `lib/compare.ts`.
- `components/ListView.tsx`: tab toggle in header (Deals | My list); list editor + comparison summary cards.

### Task 8: Fairway numeric prices (env-gated)
- `lib/sources/fairway-prices.ts`: if `process.env.GEMINI_API_KEY`, for each page image call Gemini 2.x Flash REST (`generateContent`, inline image URL fetched server-side, base64) prompting for `[{title, price}]` JSON; fuzzy-match titles to region deals (normalized token overlap ≥ 0.6); set `price`/`priceText`. Called from `fairwaySource.fetchDeals` post-mapping. Absent key → no-op. Unit test for the matcher only (no live API in tests).

### Task 9: PWA install
- `public/manifest.json` (name, standalone, theme #0a0a0a, icons), simple generated PNG icons (192/512) from an emoji-on-dark canvas via a one-off script, `<link rel="manifest">` + `apple-mobile-web-app-*` metadata in layout.

### Task 10: Verify + ship
- e2e: extend feed spec (sort works, sheet opens, list tab renders). Local run + build; deploy `vercel deploy --prod`; verify production journey in browser (autocomplete, feed images/logos, sheet, list compare); PR → squash merge → report.
