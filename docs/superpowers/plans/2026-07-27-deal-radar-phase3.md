# Deal Radar Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the five highest-value additions: unit prices, historical-low badges, push notifications for watches, shared shopping list, and Gemini "dinner from deals". (Flipp digital coupons descoped: detail endpoints 404 and the web coupons page is app-gated — no clean data path; revisit only if Flipp exposes them again.)

**Architecture:** One schema migration adds columns (`size_qty`, `size_unit`, `unit_price`, `hist_min_price`, `hist_weeks` on `deals`) and tables (`push_subscriptions`, `watches`, `lists`, `list_items`, `suggestions`) plus a `refresh_history_flags()` SQL function called after each ingest. Watches gain a server copy keyed by a device UUID so the ingest job can send Web Push. Shared lists use a 6-char code. Dinner ideas are generated during ingest (env-gated on GEMINI_API_KEY) and stored in `suggestions`.

## Global Constraints
- Everything prior (free tiers only; tests offline; mobile-first; per-source isolation).
- Web Push must degrade gracefully: no permission / not installed → watches keep working in-app.
- All new ingest steps are non-fatal (wrapped, logged to console + ingest_runs errors stay per-source).

### Task 1: Schema migration
Columns on `deals`: `size_qty numeric`, `size_unit text`, `unit_price numeric`, `hist_min_price numeric`, `hist_weeks integer`. New tables: `push_subscriptions(device_id text pk, subscription jsonb, created_at)`, `watches(device_id text, term text, max_price numeric, primary key(device_id, term))`, `notified(device_id text, dedupe_key text, created_at, primary key(device_id, dedupe_key))`, `lists(code text pk, created_at)`, `list_items(code text references lists on delete cascade, text text, created_at, primary key(code, text))`, `suggestions(id bigint identity pk, created_at, payload jsonb)`. Function `refresh_history_flags()` (security definer) updates `hist_min_price`/`hist_weeks` per (normalized_name, merchant_slug) over priced rows. RLS: enable on all; public read ONLY on `suggestions`; everything else service-role-only (no policies). Apply via dashboard SQL editor.

### Task 2: Unit prices
`lib/parse/size.ts` (TDD): `parseSize(text): {qty, unit} | null` handling "18 oz", "10.7 to 14.7-fl. oz." (use max), "2-liter", "1-lb bag", "12 ct", "6 pk", "16 fl oz", "1 gallon"→128 oz, "32-oz. cont."; normalize to oz | lb | l | ct. `unitPrice(price, size)` → per-oz/lb/l/ct rounded to 4dp. Wire into `dealRow` (parse from `name + description + price_text`). Display: small `$X.XX/oz` line on DealCard + sheet. List comparison unchanged (item totals already use unit-less prices).

### Task 3: Historical-low badges
Ingest calls `db.rpc('refresh_history_flags')` after sources complete. API already returns new columns via `select *`. UI badge on card+sheet when `price != null && hist_weeks >= 4 && price <= hist_min_price`: "🏷️ lowest in {hist_weeks}w". (Silently absent until enough weeks accumulate.)

### Task 4: Shared list
`lib/client/device.ts` (uuid v4 in localStorage). API `app/api/list/route.ts`: GET ?code= → items; POST {code?, text} → creates list (code = 6 base32 chars) when absent, adds item; DELETE {code, text}. ListView: "Share" button → creates server list from current local items, shows link `?list=CODE`, copies to clipboard; visiting with ?list=CODE joins that list (stored in prefs.listCode); when joined, all mutations go through the API and refetch on focus. Local-only mode unchanged when no code.

### Task 5: Push notifications for watches
- `npx web-push generate-vapid-keys` → env `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (Vercel + gh secrets + .env.local).
- `public/sw.js`: `push` → `showNotification(title, {body, icon, data.url})`; `notificationclick` → focus/open `/`.
- `app/api/push/route.ts`: POST {deviceId, subscription} upsert; DELETE {deviceId}.
- Watches sync: `lib/client/watches.ts` gains server upsert/delete via `app/api/watches/route.ts` (POST/DELETE {deviceId, term, maxPrice?}); still cached locally.
- Feed watches rail gains a "🔔 Notify me" button: registers `/sw.js`, `Notification.requestPermission()`, `pushManager.subscribe({userVisibleOnly: true, applicationServerKey})`, POSTs subscription. Copy notes iPhone needs Add-to-Home-Screen.
- Ingest step `lib/notify.ts` `sendWatchAlerts()`: load subscriptions + watches; fetch active priced deals once; match via `matchesForItem`; respect `max_price`; dedupe via `notified` (key = `${term}:${deal.source}:${deal.external_id}`); send via `web-push` (404/410 → delete subscription). Called from run.ts post-sources (non-fatal). Unit-test the pure match/dedupe-key builder.

### Task 6: Dinner from deals
`lib/dinner.ts` `generateDinnerIdeas(deals)` (env-gated): prompt Gemini with top ~40 produce/meat/seafood/dairy/pantry deals (name, price, store) → strict JSON `[{title, emoji, description, ingredients: [{name, dealName?, store?, price?}], estCost}]` for 3 ideas; insert into `suggestions`. Called at end of ingest, non-fatal. `app/api/dinner/route.ts` GET → latest suggestion row. Feed: "🍳 Dinner ideas" collapsible section above the grid (only when data exists): 3 cards with title, emoji, blurb, "uses N deals ~ $X at STORE"; tapping an ingredient with dealName searches it.

### Task 7: Verify + ship
Unit tests green; e2e extended lightly (list share button renders; dinner section tolerated absent). Local ingest run → verify unit_price + hist columns fill, suggestion row created, test push end-to-end locally (subscribe in browser, run sendWatchAlerts, observe notification). Deploy, verify production journey, PR → squash merge, update memory.
