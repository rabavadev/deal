# Deal Radar Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Phase 1 MVP of Deal Radar: daily ingest of grocery deals near zip 10128 from Flipp, Whole Foods, and Fairway into Supabase, surfaced in a mobile-first Next.js app (setup flow, top-deals feed, search) deployed on Vercel.

**Architecture:** Three source adapters normalize unofficial JSON/DOM feeds into a shared `FlyerInput`/`DealInput` shape. A GitHub Actions cron runs the ingest script daily (Playwright available there for Whole Foods) and upserts into Supabase Postgres. The Next.js app never scrapes — it reads the DB through server routes.

**Tech Stack:** Next.js 15 (App Router, TS strict, Tailwind v4), Supabase JS v2, vitest, tsx, Playwright (ingest + e2e), GitHub Actions, Vercel.

## Global Constraints

- $0/month: no paid APIs. No Firecrawl. No paid LLM calls anywhere.
- Node >= 20. TypeScript `strict: true`.
- All DB writes use the Supabase **service role** key, only in `scripts/` and server routes. The key never reaches client bundles (`SUPABASE_SERVICE_ROLE_KEY`, no `NEXT_PUBLIC_` prefix).
- One source failing must not abort the ingest run (per-source try/catch, recorded in `ingest_runs`).
- Unit tests never hit the network — they run against committed fixtures in `fixtures/`.
- Mobile-first UI (primary device: phone in a store).
- Spec: `docs/superpowers/specs/2026-07-27-deal-radar-design.md`. Location constants: zip 10128, home = the home address (Upper East Side, NYC) (lat 40.7823, lng -73.9525), default radius 1.5 miles.

## File Structure

```
deal-radar/
├── config/location.ts          # default location (10128), WF store id
├── lib/
│   ├── types.ts                # SourceId, FlyerInput, DealInput, DealSource, LocationConfig
│   ├── http.ts                 # fetchJson with UA + timeout + 1 retry
│   ├── geo.ts                  # haversineMiles
│   ├── parse/price.ts          # parsePrice, parseUnit
│   ├── parse/category.ts       # categorize
│   ├── parse/normalize.ts      # normalizeName, slugify
│   ├── sources/flipp.ts        # Flipp adapter (pure mappers + fetchers)
│   ├── sources/fairway.ts      # Fairway/RedPepper adapter
│   ├── sources/wholefoods-parse.ts  # pure text-grammar parser (testable)
│   ├── sources/wholefoods.ts   # Playwright fetcher (ingest-only import)
│   ├── stores/overpass.ts      # OSM branch lookup + name matching
│   ├── ingest/upsert.ts        # pure row builders (camelCase → snake_case)
│   └── db.ts                   # getServiceClient()
├── scripts/
│   ├── ingest/run.ts           # orchestrator (the thing GitHub Actions runs)
│   └── wf-find-store.ts        # one-off: discover UES Whole Foods store id
├── supabase/schema.sql
├── .github/workflows/ingest.yml
├── app/
│   ├── page.tsx                # client shell: SetupCard or Feed
│   ├── api/deals/route.ts      # feed + search
│   ├── api/meta/route.ts       # stores + freshness
│   ├── api/geocode/route.ts    # Census geocoder proxy
│   └── api/refresh/route.ts    # workflow_dispatch trigger
├── components/{SetupCard,Feed,DealCard,FlyerCrop,Chips}.tsx
├── lib/client/prefs.ts         # localStorage preferences
├── tests/                      # vitest unit tests
└── fixtures/                   # committed API captures (already present)
```

Fixtures already captured and committed: `flipp-flyers-10128.json`, `flipp-flyer-8054670.json`, `flipp-search-8054670.json`, `fairway-pages-16063900.json`, `fairway-regions-16063900.json`. Task 6 adds `wholefoods-sample.txt`.

---

### Task 1: Scaffold Next.js app + vitest

**Files:**
- Create: entire Next.js scaffold at repo root, `vitest.config.ts`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: working `npm run dev`, `npm run build`, `npm test` (vitest).

- [ ] **Step 1: Scaffold in temp dir and merge** (create-next-app refuses non-empty dirs; `docs/` and `fixtures/` already exist)

```bash
cd /tmp && npx --yes create-next-app@latest deal-radar-scaffold \
  --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm
rsync -a --exclude .git /tmp/deal-radar-scaffold/ /Users/ozansozuoz/programming-files/deal-radar/
cd /Users/ozansozuoz/programming-files/deal-radar && npm install
```

- [ ] **Step 2: Add vitest**

```bash
npm i -D vitest tsx
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname) } },
})
```

Add to `package.json` scripts: `"test": "vitest run"`.

Create `tests/smoke.test.ts`:

```ts
import { expect, test } from 'vitest'
test('vitest runs', () => { expect(1 + 1).toBe(2) })
```

- [ ] **Step 3: Verify build and tests**

Run: `npm test` → 1 passed. Run: `npm run build` → compiles.

- [ ] **Step 4: Add `.env.local` to `.gitignore` (verify create-next-app already did), commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js app with vitest"
```

---

### Task 2: Core types + price parser

**Files:**
- Create: `lib/types.ts`, `lib/parse/price.ts`, `config/location.ts`
- Test: `tests/price.test.ts`

**Interfaces:**
- Produces (used by every later task):

```ts
// lib/types.ts
export type SourceId = 'flipp' | 'wholefoods' | 'fairway'

export interface LocationConfig {
  address: string
  postalCode: string
  lat: number
  lng: number
  radiusMiles: number
  wholeFoodsStoreId: number | null
}

export interface FlyerInput {
  source: SourceId
  externalId: string
  merchantSlug: string
  merchantName: string
  title: string
  validFrom: string | null   // ISO
  validTo: string | null     // ISO
  raw?: unknown              // source-specific payload fetchDeals may need
}

export interface CropRect { image: string; x: number; y: number; w: number; h: number } // percents

export interface DealInput {
  source: SourceId
  externalId: string
  merchantSlug: string
  name: string
  description?: string | null
  price?: number | null          // numeric sale price when known
  originalPrice?: number | null
  primePrice?: number | null     // Whole Foods only
  unit?: 'ea' | 'lb' | null
  priceText?: string | null      // raw text when numeric parse failed
  saleStory?: string | null      // "20% off", "$2.00 off", "B1G1 50% off"
  category: string
  imageUrl?: string | null
  crop?: CropRect | null         // Fairway flyer snippet
  validFrom: string | null
  validTo: string | null
}

export interface DealSource {
  id: SourceId
  fetchFlyers(loc: LocationConfig): Promise<FlyerInput[]>
  fetchDeals(flyer: FlyerInput): Promise<DealInput[]>
}
```

```ts
// lib/parse/price.ts
export function parsePrice(input: string | number | null | undefined): number | null
export function parseUnit(input: string | null | undefined): 'ea' | 'lb' | null
```

- [ ] **Step 1: Write failing tests** — `tests/price.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { parsePrice, parseUnit } from '@/lib/parse/price'

describe('parsePrice', () => {
  test.each([
    [3.99, 3.99], ['3.99', 3.99], ['$3.99', 3.99], ['3.0', 3],
    ['2/$5', 2.5], ['2 for $5', 2.5], ['4 for $5', 1.25], ['2/$7.00', 3.5],
    ['$3.99/lb', 3.99], ['$5.99 ea', 5.99], ['$5.99 eawith Prime', 5.99],
    ['$6.66 ea $7.99', 6.66],           // first price wins
    ['$5.39 to $7.39/lb', null],        // ranges have no single price
    ['20% off', null], ['Buy 1, Get 1 50% off', null],
    ['', null], [null, null], [undefined, null], ['FREE', null],
  ])('parsePrice(%j) -> %j', (input, expected) => {
    expect(parsePrice(input as never)).toBe(expected)
  })
})

describe('parseUnit', () => {
  test.each([
    ['$3.99/lb', 'lb'], ['per lb', 'lb'], ['$5.99 ea', 'ea'], ['each', 'ea'],
    ['$3.99', null], [null, null],
  ])('parseUnit(%j) -> %j', (input, expected) => {
    expect(parseUnit(input as never)).toBe(expected)
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npm test` → cannot resolve `@/lib/parse/price`.

- [ ] **Step 3: Implement** — `lib/parse/price.ts`:

```ts
const MULTI = /(\d+)\s*(?:\/|for)\s*\$\s*(\d+(?:\.\d+)?)/i
const SINGLE = /\$?\s*(\d+(?:\.\d+)?)/

export function parsePrice(input: string | number | null | undefined): number | null {
  if (input == null) return null
  if (typeof input === 'number') return Number.isFinite(input) ? input : null
  const text = input.trim()
  if (!text) return null
  if (/\d\s*(?:to|-)\s*\$?\d/.test(text.replace(/\$/g, ''))) {
    // a range like "$5.39 to $7.39" has no single price
    if (/to|-/.test(text) && (text.match(/\d+(?:\.\d+)?/g) ?? []).length >= 2 && /to/i.test(text)) return null
  }
  if (/%\s*off/i.test(text) || /buy\s*\d/i.test(text)) return null
  const multi = MULTI.exec(text)
  if (multi) {
    const qty = Number(multi[1]); const total = Number(multi[2])
    return qty > 0 ? round2(total / qty) : null
  }
  // require a $ or a decimal to avoid grabbing counts like "18 oz"
  const single = SINGLE.exec(text)
  if (single && (text.includes('$') || /^\d+(\.\d+)?$/.test(text))) return round2(Number(single[1]))
  return null
}

export function parseUnit(input: string | null | undefined): 'ea' | 'lb' | null {
  if (!input) return null
  if (/(?:\/|per\s*)lb\b|\blb\b/i.test(input)) return 'lb'
  if (/\bea(?:ch)?\b/i.test(input)) return 'ea'
  return null
}

function round2(n: number): number { return Math.round(n * 100) / 100 }
```

Create `lib/types.ts` exactly as in the Interfaces block above, and `config/location.ts`:

```ts
import type { LocationConfig } from '@/lib/types'

export const DEFAULT_LOCATION: LocationConfig = {
  address: 'the home address (Upper East Side, NYC, zip 10128)',
  postalCode: '10128',
  lat: 40.7823,
  lng: -73.9525,
  radiusMiles: 1.5,
  wholeFoodsStoreId: null, // filled by Task 6 Step 5 (scripts/wf-find-store.ts)
}
```

- [ ] **Step 4: Run tests until green.** Iterate on the regexes against the test table — the table is the contract; do not weaken the tests. `npm test` → all pass.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: core types and price parser"`

---

### Task 3: Name normalization + categorizer

**Files:**
- Create: `lib/parse/normalize.ts`, `lib/parse/category.ts`
- Test: `tests/normalize.test.ts`, `tests/category.test.ts`

**Interfaces:**
- Produces: `normalizeName(name: string): string`, `slugify(name: string): string`, `categorize(name: string): string` (one of: `produce | meat | seafood | dairy | bakery | frozen | beverages | pantry | snacks | household | personal-care | other`).

- [ ] **Step 1: Failing tests** — `tests/normalize.test.ts`:

```ts
import { expect, test } from 'vitest'
import { normalizeName, slugify } from '@/lib/parse/normalize'

test('normalizeName strips sizes, punctuation, marketing', () => {
  expect(normalizeName('Organic Blueberries, 18 oz*')).toBe('organic blueberries')
  expect(normalizeName('RAGÚ PASTA SAUCE')).toBe('ragu pasta sauce')
  expect(normalizeName('Outshine Fruit Bars 10.7 to 14.7-fl. oz. pkg., Any Variety')).toBe('outshine fruit bars')
  expect(normalizeName('PEPSI SODA 2-LITER')).toBe('pepsi soda')
})

test('slugify', () => {
  expect(slugify('Morton Williams Supermarket')).toBe('morton-williams-supermarket')
  expect(slugify("BJ's Wholesale Club")).toBe('bjs-wholesale-club')
})
```

`tests/category.test.ts`:

```ts
import { expect, test } from 'vitest'
import { categorize } from '@/lib/parse/category'

test.each([
  ['Organic Blueberries', 'produce'], ['Yellow Peaches', 'produce'], ['Hass Avocados', 'produce'],
  ['Organic Ground Turkey Tray Pack', 'meat'], ['Pork or Chicken Sausage', 'meat'],
  ['Fresh Atlantic Salmon Fillets', 'seafood'], ['Fresh Halibut', 'seafood'],
  ['Chobani Greek Yogurts', 'dairy'], ['Whole Milk', 'dairy'], ['Shredded Cheese', 'dairy'],
  ['Italian Bread', 'bakery'],
  ['Outshine Fruit Bars', 'frozen'], ['Frozen Vegetables', 'frozen'], ['Ice Cream', 'frozen'],
  ['Pepsi Soda 2-Liter', 'beverages'], ['Goya Malta', 'beverages'], ['Orange Juice', 'beverages'],
  ['Ragú Pasta Sauce', 'pantry'], ['Canned Beans', 'pantry'],
  ['Lay\'s Potato Chips', 'snacks'],
  ['Bounty Paper Towels', 'household'], ['Tide Detergent', 'household'],
  ['Colgate Toothpaste', 'personal-care'],
  ['Vivitar Digital Camera', 'other'],
])('categorize(%s) -> %s', (name, expected) => {
  expect(categorize(name)).toBe(expected)
})
```

- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** — `lib/parse/normalize.ts`:

```ts
export function normalizeName(name: string): string {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')        // strip accents
    .toLowerCase()
    .replace(/\b\d+(\.\d+)?\s*(?:to\s+\d+(\.\d+)?[\s-]*)?(?:fl\.?\s*)?(?:oz|lb|lbs|ct|liter|litre|l|ml|g|kg|pk|pkg|pack)\b\.?/g, ' ')
    .replace(/\b(any variety|assorted|selected varieties|select varieties|tray pack)\b/g, ' ')
    .replace(/\b\d+[\s-]*(?:liter|litre)\b/g, ' ')
    .replace(/[*,.!()]/g, ' ')
    .replace(/\s+-\s+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function slugify(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
```

`lib/parse/category.ts` — ordered rules, first match wins (seafood before meat, frozen before produce so "frozen fruit" lands in frozen):

```ts
const RULES: Array<[RegExp, string]> = [
  [/salmon|halibut|shrimp|tuna|cod|tilapia|crab|lobster|scallop|seafood|fish\b/i, 'seafood'],
  [/frozen|ice cream|fruit bars|popsicle|pizza rolls/i, 'frozen'],
  [/beef|chicken|pork|turkey|sausage|bacon|ham\b|hot dog|meatball|steak|lamb|kielbasa|salami|deli meat/i, 'meat'],
  [/milk|yogurt|cheese|butter|cream\b|creamer|eggs?\b|cottage/i, 'dairy'],
  [/bread|bagel|bakery|muffin|croissant|roll[s]?\b|cake|donut/i, 'bakery'],
  [/soda|juice|water\b|coffee|tea\b|malta|drink|beverage|cola|seltzer|lemonade/i, 'beverages'],
  [/berries|blueberr|strawberr|apple|banana|peach|nectarine|avocado|grape|melon|watermelon|cherr|lettuce|tomato|onion|potato|pepper[s]?\b|zucchini|broccoli|spinach|kale|cucumber|carrot|citrus|orange[s]?\b|lemon|lime|mango|pear|plum|apricot|grapefruit|produce|salad|vegetable|fruit\b/i, 'produce'],
  [/chips|pretzel|popcorn|cracker|cookie|candy|chocolate|granola|trail mix|nuts\b|snack/i, 'snacks'],
  [/paper towel|toilet|detergent|dish|cleaner|bleach|trash|foil|napkin|swiffer|air freshener/i, 'household'],
  [/toothpaste|shampoo|soap\b|deodorant|razor|lotion|vitamins?|body wash/i, 'personal-care'],
  [/pasta|sauce|rice\b|beans|canned|soup|cereal|flour|sugar|oil\b|vinegar|condiment|ketchup|mayo|salsa|spice|seasoning|peanut butter|jelly|yogurts?\b/i, 'pantry'],
]

export function categorize(name: string): string {
  for (const [re, cat] of RULES) if (re.test(name)) return cat
  return 'other'
}
```

Note: `dairy` intentionally precedes `pantry`'s trailing `yogurts?` catch — keep RULES order exactly as written; the tests pin the behavior.

- [ ] **Step 4: Run until green.** Adjust regex order only; the test table is the contract.
- [ ] **Step 5: Commit** — `git commit -am "feat: name normalization and category rules"`

---

### Task 4: Flipp adapter

**Files:**
- Create: `lib/http.ts`, `lib/sources/flipp.ts`
- Test: `tests/flipp.test.ts` (uses `fixtures/flipp-flyers-10128.json`, `fixtures/flipp-flyer-8054670.json`)

**Interfaces:**
- Consumes: `FlyerInput`, `DealInput`, `parsePrice`, `categorize`, `normalizeName`, `slugify`.
- Produces:

```ts
// lib/http.ts
export async function fetchJson<T>(url: string): Promise<T>  // UA header, 20s timeout, 1 retry on failure
// lib/sources/flipp.ts
export function mapFlippFlyers(payload: unknown): FlyerInput[]        // pure
export function mapFlippItems(flyer: FlyerInput, payload: unknown): DealInput[]  // pure
export const flippSource: DealSource                                   // wires fetchJson + mappers
```

Verified API shapes (fixtures): flyer list objects carry `id, merchant, name, valid_from, valid_to, categories, merchant_logo`; `GET /flipp/flyers/{id}?locale=en-us&postal_code={zip}` returns `{items: [...], pages: [...]}` where each item has `id, name, price (string|null), valid_from, valid_to, cutout_image_url, brand`.

- [ ] **Step 1: Failing tests** — `tests/flipp.test.ts`:

```ts
import { expect, test } from 'vitest'
import { readFileSync } from 'fs'
import { mapFlippFlyers, mapFlippItems } from '@/lib/sources/flipp'

const flyersPayload = JSON.parse(readFileSync('fixtures/flipp-flyers-10128.json', 'utf8'))
const itemsPayload = JSON.parse(readFileSync('fixtures/flipp-flyer-8054670.json', 'utf8'))

test('mapFlippFlyers keeps only grocery flyers and maps fields', () => {
  const flyers = mapFlippFlyers(flyersPayload)
  expect(flyers.length).toBeGreaterThan(10)
  for (const f of flyers) {
    expect(f.source).toBe('flipp')
    expect(f.externalId).toMatch(/^\d+$/)
    expect(f.merchantSlug).toMatch(/^[a-z0-9-]+$/)
    expect(f.validFrom).toBeTruthy()
    expect(f.validTo).toBeTruthy()
  }
  expect(flyers.some(f => f.merchantSlug === 'aldi')).toBe(true)
  // non-grocery merchants excluded
  expect(flyers.some(f => f.merchantSlug === 'best-buy')).toBe(false)
})

test('mapFlippItems maps deals with parsed prices', () => {
  const flyer = mapFlippFlyers(flyersPayload).find(f => f.externalId === '8054670')
    ?? mapFlippFlyers(flyersPayload)[0]
  const deals = mapFlippItems(flyer, itemsPayload)
  expect(deals.length).toBe(150)
  const ragu = deals.find(d => d.name.toLowerCase().includes('rag'))
  expect(ragu?.price).toBe(3.99)
  expect(ragu?.category).toBe('pantry')
  expect(ragu?.imageUrl).toContain('wishabi')
  expect(ragu?.validTo).toBeTruthy()
  for (const d of deals) expect(d.externalId).toMatch(/^\d+$/)
})
```

- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** — `lib/http.ts`:

```ts
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }

export async function fetchJson<T>(url: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20_000) })
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
      return (await res.json()) as T
    } catch (err) {
      if (attempt >= 1) throw err
      await new Promise(r => setTimeout(r, 2_000))
    }
  }
}
```

`lib/sources/flipp.ts`:

```ts
import { fetchJson } from '@/lib/http'
import { parsePrice } from '@/lib/parse/price'
import { categorize } from '@/lib/parse/category'
import { slugify } from '@/lib/parse/normalize'
import type { DealInput, DealSource, FlyerInput, LocationConfig } from '@/lib/types'

const BASE = 'https://backflipp.wishabi.com/flipp'

type FlippFlyer = {
  id: number; merchant: string; name: string
  valid_from: string | null; valid_to: string | null
  categories: string[] | null
}
type FlippItem = {
  id: number; name: string | null; price: string | null
  valid_from: string | null; valid_to: string | null
  cutout_image_url: string | null; brand: string | null
}

export function mapFlippFlyers(payload: unknown): FlyerInput[] {
  const list = (Array.isArray(payload) ? payload : (payload as { flyers?: FlippFlyer[] })?.flyers ?? []) as FlippFlyer[]
  return list
    .filter(f => (f.categories ?? []).includes('Groceries'))
    .map(f => ({
      source: 'flipp' as const,
      externalId: String(f.id),
      merchantSlug: slugify(f.merchant),
      merchantName: f.merchant.trim(),
      title: f.name,
      validFrom: f.valid_from,
      validTo: f.valid_to,
    }))
}

export function mapFlippItems(flyer: FlyerInput, payload: unknown): DealInput[] {
  const items = ((payload as { items?: FlippItem[] })?.items ?? []) as FlippItem[]
  return items
    .filter(it => it.name)
    .map(it => ({
      source: 'flipp' as const,
      externalId: String(it.id),
      merchantSlug: flyer.merchantSlug,
      name: it.name!.trim(),
      price: parsePrice(it.price),
      priceText: it.price ?? null,
      category: categorize(it.name!),
      imageUrl: it.cutout_image_url,
      validFrom: it.valid_from ?? flyer.validFrom,
      validTo: it.valid_to ?? flyer.validTo,
    }))
}

export const flippSource: DealSource = {
  id: 'flipp',
  async fetchFlyers(loc: LocationConfig) {
    const payload = await fetchJson(`${BASE}/flyers?locale=en-us&postal_code=${loc.postalCode}`)
    return mapFlippFlyers(payload)
  },
  async fetchDeals(flyer: FlyerInput) {
    const payload = await fetchJson(`${BASE}/flyers/${flyer.externalId}?locale=en-us&postal_code=10128`)
    return mapFlippItems(flyer, payload)
  },
}
```

- [ ] **Step 4: Run tests until green.**
- [ ] **Step 5: Commit** — `git commit -am "feat: Flipp source adapter"`

---

### Task 5: Fairway (RedPepper) adapter

**Files:**
- Create: `lib/sources/fairway.ts`
- Test: `tests/fairway.test.ts` (uses `fixtures/fairway-pages-16063900.json`, `fixtures/fairway-regions-16063900.json`)

**Interfaces:**
- Consumes: `fetchJson`, `categorize`, `parsePrice`, `CropRect`.
- Produces:

```ts
export function parseCoords(coords: string): { x: number; y: number; w: number; h: number } | null
export function mapFairwayCatalogues(payload: unknown): FlyerInput[]
export function mapFairwayRegions(flyer: FlyerInput, regionsPayload: unknown, pagesPayload: unknown): DealInput[]
export const fairwaySource: DealSource
```

Verified shapes: catalogues list → `[{nid_1, title, start, finish, ...}]`; page-images → `[{page: '1', image: 'https://…jpeg', ...}]`; regions → `{ '0': Region[], '1': Region[], … }` keyed by page index where product regions have `field_region_type === 'product'`, `field_product_title`, `field_product_description`, `coords` like `"26.03,76.29,1000001,24.39,18.96"` (x%, y%, z-index, w%, h%), `field_product_image_url: string[]`, `id`.
Note: regions page keys are 0-based; page-images `page` values are 1-based — `regions['1']` maps to page-images `page === '1'`? **No.** Verified empirically: `regions['0']` is empty and `regions['1']` holds page-1 products, so regions keys align directly with page-images `page` strings. Use the key as the page number, skipping key `'0'`.

- [ ] **Step 1: Failing tests** — `tests/fairway.test.ts`:

```ts
import { expect, test } from 'vitest'
import { readFileSync } from 'fs'
import { mapFairwayCatalogues, mapFairwayRegions, parseCoords } from '@/lib/sources/fairway'
import type { FlyerInput } from '@/lib/types'

const pages = JSON.parse(readFileSync('fixtures/fairway-pages-16063900.json', 'utf8'))
const regions = JSON.parse(readFileSync('fixtures/fairway-regions-16063900.json', 'utf8'))

test('parseCoords', () => {
  expect(parseCoords('26.03,76.29,1000001,24.39,18.96')).toEqual({ x: 26.03, y: 76.29, w: 24.39, h: 18.96 })
  expect(parseCoords('bad')).toBeNull()
})

const flyer: FlyerInput = {
  source: 'fairway', externalId: '16063900', merchantSlug: 'fairway', merchantName: 'Fairway Market',
  title: 'Weekly Ad July 24th to July 30th', validFrom: '2026-07-23T00:00', validTo: '2026-07-30T23:59',
}

test('mapFairwayRegions produces deals with crops', () => {
  const deals = mapFairwayRegions(flyer, regions, pages)
  expect(deals.length).toBeGreaterThan(80)
  const outshine = deals.find(d => d.name === 'Outshine Fruit Bars')
  expect(outshine).toBeDefined()
  expect(outshine!.description).toContain('Any Variety')
  expect(outshine!.crop).toBeTruthy()
  expect(outshine!.crop!.image).toContain('cloudfront')
  expect(outshine!.crop!.w).toBeGreaterThan(0)
  expect(outshine!.validTo).toBe(flyer.validTo)
  // no numeric prices in Phase 1 for Fairway
  expect(outshine!.price ?? null).toBeNull()
})
```

- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** — `lib/sources/fairway.ts`:

```ts
import { fetchJson } from '@/lib/http'
import { categorize } from '@/lib/parse/category'
import type { DealInput, DealSource, FlyerInput } from '@/lib/types'

const NODE = 'https://node.redpepper.digital'
const CLIENT_ID = 4650  // Fairway Market

type Catalogue = { nid_1: string; title: string; start: string; finish: string }
type PageImage = { page: string; image: string }
type Region = {
  id: string; coords: string
  field_region_type: string
  field_product_title: string
  field_product_description: string
  field_product_image_url?: string[]
}

export function parseCoords(coords: string): { x: number; y: number; w: number; h: number } | null {
  const parts = coords.split(',').map(Number)
  if (parts.length < 5 || parts.some(Number.isNaN)) return null
  const [x, y, , w, h] = parts
  return { x, y, w, h }
}

export function mapFairwayCatalogues(payload: unknown): FlyerInput[] {
  const list = (payload as Catalogue[]) ?? []
  return list.filter(c => c.nid_1).map(c => ({
    source: 'fairway' as const,
    externalId: c.nid_1,
    merchantSlug: 'fairway',
    merchantName: 'Fairway Market',
    title: c.title,
    validFrom: c.start ?? null,
    validTo: c.finish ?? null,
  }))
}

export function mapFairwayRegions(flyer: FlyerInput, regionsPayload: unknown, pagesPayload: unknown): DealInput[] {
  const pages = (pagesPayload as PageImage[]) ?? []
  const imageByPage = new Map(pages.map(p => [p.page, p.image]))
  const regionsByPage = (regionsPayload ?? {}) as Record<string, Region[]>
  const deals: DealInput[] = []
  for (const [pageKey, regions] of Object.entries(regionsByPage)) {
    if (pageKey === '0') continue
    const pageImage = imageByPage.get(pageKey)
    for (const r of regions ?? []) {
      if (r.field_region_type !== 'product' || !r.field_product_title) continue
      const rect = parseCoords(r.coords)
      deals.push({
        source: 'fairway',
        externalId: r.id,
        merchantSlug: 'fairway',
        name: r.field_product_title.trim(),
        description: r.field_product_description || null,
        category: categorize(r.field_product_title),
        imageUrl: r.field_product_image_url?.[0] ?? null,
        crop: pageImage && rect ? { image: pageImage, ...rect } : null,
        validFrom: flyer.validFrom,
        validTo: flyer.validTo,
      })
    }
  }
  return deals
}

export const fairwaySource: DealSource = {
  id: 'fairway',
  async fetchFlyers() {
    const payload = await fetchJson(`${NODE}/client/${CLIENT_ID}/catalogues/json?_format=json`)
    return mapFairwayCatalogues(payload)
  },
  async fetchDeals(flyer: FlyerInput) {
    const pages = await fetchJson<PageImage[]>(`${NODE}/catalogue/${flyer.externalId}/page-images/json?_format=json`)
    const regions = await fetchJson(`${NODE}/rpms_catalogue/${flyer.externalId}/page/0/${pages.length}/regions`)
    return mapFairwayRegions(flyer, regions, pages)
  },
}
```

- [ ] **Step 4: Run until green.**
- [ ] **Step 5: Commit** — `git commit -am "feat: Fairway RedPepper source adapter"`

---

### Task 6: Whole Foods adapter

**Files:**
- Create: `lib/sources/wholefoods-parse.ts`, `lib/sources/wholefoods.ts`, `scripts/wf-find-store.ts`, `fixtures/wholefoods-sample.txt`
- Test: `tests/wholefoods.test.ts`
- Modify: `config/location.ts` (fill `wholeFoodsStoreId`)

**Interfaces:**
- Consumes: `parsePrice`, `parseUnit`, `categorize`.
- Produces:

```ts
// wholefoods-parse.ts (pure, no Playwright)
export interface WfRawDeal { name: string; brand: string | null; primeText: string; nonPrimeText: string | null; regularText: string | null; expiry: string | null }
export function parseWholeFoodsText(bodyText: string): WfRawDeal[]
export function wfToDeals(raw: WfRawDeal[], storeId: number, ingestDateIso: string): DealInput[]
// wholefoods.ts (ingest-only; dynamic-imports playwright)
export const wholeFoodsSource: DealSource   // fetchFlyers returns one synthetic flyer per week
```

- [ ] **Step 1: Create the fixture** — `fixtures/wholefoods-sample.txt` with this exact observed content (captured live 2026-07-27 from `sales-flyer?store-id=10713`):

```
This Week's Top Sales at Manhattan West
Change store
Eligible Prime members can earn 5% back at Whole Foods Market.
Learn more
Exp. 07/28
Organic
Blueberries, 18 oz*
$5.99 eawith Prime
$6.66 ea $7.99
Add to Cart
Exp. 07/28
Organic
Red Cherries*
$5.99/lbwith Prime
$6.66/lb $7.99/lb
Add to Cart
Exp. 07/28
Yellow Peaches*
$2.49/lbwith Prime
$2.77/lb $3.29/lb
Add to Cart
Exp. 07/28
Sustainable Wild Caught
Fresh Halibut Fillets*
20% offwith Prime
11% off $34.99/lb
Add to Cart
Exp. 07/28
No-Antibiotics-Ever
Organic Ground Turkey Tray Pack*
Buy 1, Get 1 50% offwith Prime
$9.49
View All
Exp. 07/28
Medium Hass Avocados*
4 for $5with Prime
4 for $5.56 $1.09
Add to Cart
Exp. 07/28
Applegate
Organic Chicken Nuggets, Strips or Turkey Burgers*
25% offwith Prime
16% off $10.49 to $14.99
View All
```

- [ ] **Step 2: Failing tests** — `tests/wholefoods.test.ts`:

```ts
import { expect, test } from 'vitest'
import { readFileSync } from 'fs'
import { parseWholeFoodsText, wfToDeals } from '@/lib/sources/wholefoods-parse'

const text = readFileSync('fixtures/wholefoods-sample.txt', 'utf8')

test('parses all deal blocks', () => {
  const deals = parseWholeFoodsText(text)
  expect(deals).toHaveLength(7)
  expect(deals[0]).toEqual({
    name: 'Blueberries, 18 oz', brand: 'Organic',
    primeText: '$5.99 ea', nonPrimeText: '$6.66 ea', regularText: '$7.99', expiry: '07/28',
  })
  const halibut = deals.find(d => d.name.includes('Halibut'))!
  expect(halibut.primeText).toBe('20% off')
  expect(halibut.nonPrimeText).toBe('11% off')
  expect(halibut.regularText).toBe('$34.99/lb')
  const avocado = deals.find(d => d.name.includes('Avocados'))!
  expect(avocado.primeText).toBe('4 for $5')
})

test('wfToDeals converts to DealInput', () => {
  const deals = wfToDeals(parseWholeFoodsText(text), 10713, '2026-07-27T00:00:00-04:00')
  const blueberries = deals.find(d => d.name.startsWith('Blueberries'))!
  expect(blueberries.primePrice).toBe(5.99)
  expect(blueberries.price).toBe(6.66)
  expect(blueberries.originalPrice).toBe(7.99)
  expect(blueberries.unit).toBe('ea')
  expect(blueberries.category).toBe('produce')
  expect(blueberries.validTo).toContain('2026-07-28')
  expect(blueberries.source).toBe('wholefoods')
  const halibut = deals.find(d => d.name.includes('Halibut'))!
  expect(halibut.price).toBeNull()
  expect(halibut.saleStory).toBe('11% off (20% off with Prime)')
})
```

- [ ] **Step 3: Run, verify fail.**
- [ ] **Step 4: Implement** — `lib/sources/wholefoods-parse.ts`:

```ts
import { parsePrice, parseUnit } from '@/lib/parse/price'
import { categorize } from '@/lib/parse/category'
import type { DealInput } from '@/lib/types'

export interface WfRawDeal {
  name: string; brand: string | null
  primeText: string; nonPrimeText: string | null; regularText: string | null
  expiry: string | null
}

const EXP = /^Exp\.?\s*(\d{2}\/\d{2})\.?$/
const NOISE = /^(Add to Cart|View All|Change store|Learn more|Valid \d|Save big|Dig into|View deals|Eligible Prime|This Week)/i

export function parseWholeFoodsText(bodyText: string): WfRawDeal[] {
  const lines = bodyText.split('\n').map(l => l.trim()).filter(Boolean)
  const deals: WfRawDeal[] = []
  for (let i = 0; i < lines.length; i++) {
    const exp = EXP.exec(lines[i])
    if (!exp) continue
    // collect until the "…with Prime" line
    const block: string[] = []
    let j = i + 1
    while (j < lines.length && !lines[j].includes('with Prime') && !EXP.test(lines[j]) && block.length < 5) {
      if (!NOISE.test(lines[j])) block.push(lines[j])
      j++
    }
    if (j >= lines.length || !lines[j]?.includes('with Prime') || block.length === 0) continue
    const primeText = lines[j].replace(/with Prime.*$/, '').trim()
    // next line: "<nonPrime> <regular>" or a single regular price
    let nonPrimeText: string | null = null
    let regularText: string | null = null
    const priceLine = lines[j + 1] && !NOISE.test(lines[j + 1]) && !EXP.test(lines[j + 1]) ? lines[j + 1] : null
    if (priceLine) ({ nonPrimeText, regularText } = splitPriceLine(priceLine))
    const name = block.pop()!.replace(/\*+$/, '').trim()
    const brand = block.length ? block.join(' ') : null
    deals.push({ name, brand, primeText, nonPrimeText, regularText, expiry: exp[1] })
  }
  return deals
}

function splitPriceLine(line: string): { nonPrimeText: string | null; regularText: string | null } {
  // "$6.66 ea $7.99" | "11% off $34.99/lb" | "4 for $5.56 $1.09" | "$9.49"
  const pctMatch = /^(\d+% off)\s+(.*)$/.exec(line)
  if (pctMatch) return { nonPrimeText: pctMatch[1], regularText: pctMatch[2] || null }
  const multi = /^(\d+\s*for\s*\$\d+(?:\.\d+)?)\s*(.*)$/.exec(line)
  if (multi) return { nonPrimeText: multi[1], regularText: multi[2] || null }
  const prices = line.match(/\$\d+(?:\.\d+)?(?:\/lb| ea)?/g) ?? []
  if (prices.length >= 2) return { nonPrimeText: prices.slice(0, -1).join(' '), regularText: prices[prices.length - 1] }
  if (prices.length === 1) return { nonPrimeText: null, regularText: prices[0] }
  return { nonPrimeText: null, regularText: null }
}

export function wfToDeals(raw: WfRawDeal[], storeId: number, ingestDateIso: string): DealInput[] {
  const year = ingestDateIso.slice(0, 4)
  return raw.map((r, idx) => {
    const price = parsePrice(r.nonPrimeText)
    const primePrice = parsePrice(r.primeText)
    const isPctDeal = price == null && /%|buy/i.test(r.primeText)
    const validTo = r.expiry ? `${year}-${r.expiry.replace('/', '-')}T23:59:59-04:00` : null
    const fullName = r.name
    return {
      source: 'wholefoods' as const,
      externalId: `${storeId}-${r.expiry ?? 'noexp'}-${slugKey(fullName)}-${idx}`,
      merchantSlug: 'whole-foods-market',
      name: fullName,
      description: r.brand,
      price,
      primePrice,
      originalPrice: parsePrice(r.regularText),
      unit: parseUnit(r.nonPrimeText ?? r.primeText ?? r.regularText),
      priceText: r.nonPrimeText ?? r.primeText,
      saleStory: isPctDeal ? `${r.nonPrimeText ?? r.primeText} (${r.primeText} with Prime)` : null,
      category: categorize(fullName),
      imageUrl: null,
      validFrom: ingestDateIso,
      validTo,
    }
  })
}

function slugKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
}
```

- [ ] **Step 5: Run until green.** The fixture + assertions are the contract; refine `splitPriceLine` as needed to satisfy them.

- [ ] **Step 6: Playwright fetcher** — `npm i -D playwright` then `lib/sources/wholefoods.ts`:

```ts
import { DEFAULT_LOCATION } from '@/config/location'
import { parseWholeFoodsText, wfToDeals } from './wholefoods-parse'
import type { DealSource, FlyerInput } from '@/lib/types'

export const wholeFoodsSource: DealSource = {
  id: 'wholefoods',
  async fetchFlyers() {
    const storeId = DEFAULT_LOCATION.wholeFoodsStoreId
    if (!storeId) return []
    const now = new Date().toISOString()
    return [{
      source: 'wholefoods', externalId: `wf-${storeId}-${now.slice(0, 10)}`,
      merchantSlug: 'whole-foods-market', merchantName: 'Whole Foods Market',
      title: 'Weekly Sales', validFrom: now, validTo: null, raw: { storeId },
    }]
  },
  async fetchDeals(flyer: FlyerInput) {
    const { storeId } = flyer.raw as { storeId: number }
    const { chromium } = await import('playwright')
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' })
      await page.goto(`https://www.wholefoodsmarket.com/sales-flyer?store-id=${storeId}`, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      await page.waitForTimeout(5_000) // let client hydration finish
      const text = await page.evaluate(() => document.body.innerText)
      const deals = wfToDeals(parseWholeFoodsText(text), storeId, new Date().toISOString())
      if (deals.length === 0) throw new Error('Whole Foods parse produced 0 deals — page layout may have changed')
      // set flyer validTo from the most common expiry
      return deals
    } finally {
      await browser.close()
    }
  },
}
```

- [ ] **Step 7: Find the UES store id** — `scripts/wf-find-store.ts`:

```ts
import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const hits: unknown[] = []
  page.on('response', async res => {
    if (res.url().includes('/api/stores') && res.status() === 200) {
      try { hits.push({ url: res.url(), body: await res.json() }) } catch {}
    }
  })
  await page.goto('https://www.wholefoodsmarket.com/stores?address=10128', { waitUntil: 'domcontentloaded', timeout: 45_000 })
  await page.waitForTimeout(6_000)
  console.log(JSON.stringify(hits, null, 2))
  await browser.close()
}
main()
```

Run: `npx playwright install chromium && npx tsx scripts/wf-find-store.ts`. Read the output for the store nearest E 90th St (expect the 3rd Ave & E 87th St location, "Upper East Side"). If the `/stores` page yields nothing, fall back: open `https://www.wholefoodsmarket.com/sales-flyer` in the user's browser, use "Change store" to pick Upper East Side, and read `store-id` from the URL. Set the numeric id in `config/location.ts` `wholeFoodsStoreId`.

- [ ] **Step 8: Live smoke (manual, not CI):** `npx tsx -e "import('./lib/sources/wholefoods').then(async m => { const [f] = await m.wholeFoodsSource.fetchFlyers({} as never); console.log((await m.wholeFoodsSource.fetchDeals(f)).slice(0,5)) })"` — expect ≥ 20 deals with sensible names/prices for the UES store. If Amazon blocks the datacenter later in CI, add `--disable-blink-features=AutomationControlled` launch arg (known mitigation) — record actual behavior in the PR/commit message.

- [ ] **Step 9: Commit** — `git add -A && git commit -m "feat: Whole Foods adapter with text-grammar parser"`

---

### Task 7: Supabase project + schema

**Files:**
- Create: `supabase/schema.sql`, `lib/db.ts`, `.env.local` (not committed)

**Interfaces:**
- Produces: live Supabase project `deal-radar`; `getServiceClient(): SupabaseClient` reading `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env; tables `stores`, `flyers`, `deals`, `ingest_runs` with public-read RLS.

- [ ] **Step 1: Create the Supabase project via the user's Chrome** (explicit permission given). In the dashboard org `captainzojiro@gmail.com's Org`: New project → name `deal-radar`, region `us-east-1` (closest to NYC), generate a strong DB password. Copy the project URL and the `service_role` key (Settings → API) into `/Users/ozansozuoz/programming-files/deal-radar/.env.local`:

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

Do NOT read or store the DB password anywhere else; it is only needed by Supabase itself.

- [ ] **Step 2: Write** `supabase/schema.sql`:

```sql
create table if not exists stores (
  id bigint generated always as identity primary key,
  source text not null,
  slug text not null,
  name text not null,
  logo_url text,
  branch_address text,
  lat double precision,
  lng double precision,
  distance_miles numeric,
  unique (source, slug)
);

create table if not exists flyers (
  id bigint generated always as identity primary key,
  source text not null,
  external_id text not null,
  merchant_slug text not null,
  merchant_name text not null,
  title text,
  valid_from timestamptz,
  valid_to timestamptz,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique (source, external_id)
);

create table if not exists deals (
  id bigint generated always as identity primary key,
  flyer_id bigint not null references flyers(id) on delete cascade,
  source text not null,
  external_id text not null,
  merchant_slug text not null,
  name text not null,
  normalized_name text not null,
  description text,
  price numeric,
  original_price numeric,
  prime_price numeric,
  unit text,
  price_text text,
  sale_story text,
  category text not null default 'other',
  image_url text,
  crop jsonb,
  valid_from timestamptz,
  valid_to timestamptz,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  discount_pct numeric generated always as (
    case when original_price > 0 and price is not null and price < original_price
         then round((1 - price / original_price) * 100) end
  ) stored,
  unique (source, external_id)
);

create index if not exists deals_validity_idx on deals (valid_from, valid_to);
create index if not exists deals_merchant_idx on deals (merchant_slug);
create index if not exists deals_name_idx on deals (normalized_name);

create table if not exists ingest_runs (
  id bigint generated always as identity primary key,
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  flyer_count integer not null default 0,
  deal_count integer not null default 0,
  error text
);

alter table stores enable row level security;
alter table flyers enable row level security;
alter table deals enable row level security;
alter table ingest_runs enable row level security;
create policy "public read stores" on stores for select using (true);
create policy "public read flyers" on flyers for select using (true);
create policy "public read deals" on deals for select using (true);
create policy "public read ingest_runs" on ingest_runs for select using (true);
```

- [ ] **Step 3: Apply it** — paste `supabase/schema.sql` into the Supabase SQL Editor (user's Chrome) and run. Expected: "Success. No rows returned".

- [ ] **Step 4:** `npm i @supabase/supabase-js` and create `lib/db.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function getServiceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set')
  client ??= createClient(url, key, { auth: { persistSession: false } })
  return client
}
```

- [ ] **Step 5: Verify connectivity** — `npx tsx -e "import('dotenv/config'); import('./lib/db').then(async m => console.log(await m.getServiceClient().from('deals').select('id').limit(1)))"` (add `npm i -D dotenv`; scripts load `.env.local` via `dotenv/config` with `DOTENV_CONFIG_PATH=.env.local`). Expected: `{ data: [], error: null }`.

- [ ] **Step 6: Commit** — `git add supabase lib/db.ts package*.json && git commit -m "feat: Supabase schema and client"`

---

### Task 8: Ingest orchestrator

**Files:**
- Create: `lib/ingest/upsert.ts`, `scripts/ingest/run.ts`
- Test: `tests/upsert.test.ts`

**Interfaces:**
- Consumes: `DealSource` implementations, `getServiceClient`, `normalizeName`.
- Produces:

```ts
// lib/ingest/upsert.ts
export function flyerRow(f: FlyerInput): Record<string, unknown>          // snake_case, sets last_seen
export function dealRow(d: DealInput, flyerId: number): Record<string, unknown>
// scripts/ingest/run.ts — CLI entry: npx tsx scripts/ingest/run.ts
```

- [ ] **Step 1: Failing tests** — `tests/upsert.test.ts`:

```ts
import { expect, test } from 'vitest'
import { dealRow, flyerRow } from '@/lib/ingest/upsert'
import type { DealInput, FlyerInput } from '@/lib/types'

const flyer: FlyerInput = {
  source: 'flipp', externalId: '8054670', merchantSlug: 'extra-supermarket',
  merchantName: 'Extra Supermarket', title: 'Indexed Bi-Weekly',
  validFrom: '2026-07-24T00:00:00-04:00', validTo: '2026-08-06T23:59:59-04:00',
}

test('flyerRow maps to snake_case', () => {
  const row = flyerRow(flyer)
  expect(row).toMatchObject({
    source: 'flipp', external_id: '8054670', merchant_slug: 'extra-supermarket',
    merchant_name: 'Extra Supermarket', valid_from: flyer.validFrom, valid_to: flyer.validTo,
  })
  expect(row.last_seen).toBeTruthy()
})

test('dealRow maps, computes normalized_name, keeps crop json', () => {
  const deal: DealInput = {
    source: 'fairway', externalId: '16155546', merchantSlug: 'fairway',
    name: 'Outshine Fruit Bars', category: 'frozen',
    crop: { image: 'https://x/p1.jpeg', x: 26, y: 76, w: 24, h: 19 },
    validFrom: null, validTo: '2026-07-30T23:59',
  }
  const row = dealRow(deal, 42)
  expect(row).toMatchObject({
    flyer_id: 42, external_id: '16155546', name: 'Outshine Fruit Bars',
    normalized_name: 'outshine fruit bars', category: 'frozen',
  })
  expect(row.crop).toEqual(deal.crop)
  expect(row.price ?? null).toBeNull()
})
```

- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** — `lib/ingest/upsert.ts`:

```ts
import { normalizeName } from '@/lib/parse/normalize'
import type { DealInput, FlyerInput } from '@/lib/types'

export function flyerRow(f: FlyerInput) {
  return {
    source: f.source, external_id: f.externalId,
    merchant_slug: f.merchantSlug, merchant_name: f.merchantName,
    title: f.title, valid_from: f.validFrom, valid_to: f.validTo,
    last_seen: new Date().toISOString(),
  }
}

export function dealRow(d: DealInput, flyerId: number) {
  return {
    flyer_id: flyerId, source: d.source, external_id: d.externalId,
    merchant_slug: d.merchantSlug, name: d.name,
    normalized_name: normalizeName(d.name),
    description: d.description ?? null,
    price: d.price ?? null, original_price: d.originalPrice ?? null,
    prime_price: d.primePrice ?? null, unit: d.unit ?? null,
    price_text: d.priceText ?? null, sale_story: d.saleStory ?? null,
    category: d.category, image_url: d.imageUrl ?? null, crop: d.crop ?? null,
    valid_from: d.validFrom, valid_to: d.validTo,
    last_seen: new Date().toISOString(),
  }
}
```

- [ ] **Step 4: Run until green, then write the orchestrator** — `scripts/ingest/run.ts`:

```ts
import 'dotenv/config'
import { getServiceClient } from '@/lib/db'
import { dealRow, flyerRow } from '@/lib/ingest/upsert'
import { flippSource } from '@/lib/sources/flipp'
import { fairwaySource } from '@/lib/sources/fairway'
import { wholeFoodsSource } from '@/lib/sources/wholefoods'
import { DEFAULT_LOCATION } from '@/config/location'
import { syncStores } from '@/lib/stores/overpass'
import type { DealSource } from '@/lib/types'

const sources: DealSource[] = [flippSource, fairwaySource, wholeFoodsSource]

async function runSource(src: DealSource) {
  const db = getServiceClient()
  const started = new Date().toISOString()
  let flyerCount = 0, dealCount = 0, error: string | null = null
  try {
    const flyers = await src.fetchFlyers(DEFAULT_LOCATION)
    for (const flyer of flyers) {
      const { data: frow, error: ferr } = await db.from('flyers')
        .upsert(flyerRow(flyer), { onConflict: 'source,external_id' })
        .select('id').single()
      if (ferr || !frow) throw new Error(`flyer upsert failed: ${ferr?.message}`)
      flyerCount++
      let deals
      try { deals = await src.fetchDeals(flyer) }
      catch (e) { console.error(`[${src.id}] deals failed for flyer ${flyer.externalId}:`, e); continue }
      if (deals.length === 0) continue
      const rows = deals.map(d => dealRow(d, frow.id))
      const { error: derr } = await db.from('deals').upsert(rows, { onConflict: 'source,external_id' })
      if (derr) throw new Error(`deal upsert failed: ${derr.message}`)
      dealCount += rows.length
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
    console.error(`[${src.id}] FAILED:`, error)
  }
  await db.from('ingest_runs').insert({
    source: src.id, started_at: started, finished_at: new Date().toISOString(),
    flyer_count: flyerCount, deal_count: dealCount, error,
  })
  console.log(`[${src.id}] flyers=${flyerCount} deals=${dealCount} error=${error ?? 'none'}`)
  return error === null
}

async function main() {
  const results = await Promise.all(sources.map(runSource))
  try { await syncStores(DEFAULT_LOCATION) } catch (e) { console.error('store sync failed:', e) }
  if (results.every(ok => !ok)) process.exit(1) // only fail the job if EVERY source failed
}
main()
```

Note: `syncStores` arrives in Task 9 — create a stub now so this compiles: `lib/stores/overpass.ts` exporting `export async function syncStores() {}` (replaced next task). tsx does not resolve `@/` by default — add `tsconfig.json` paths already covers it via `tsx` v4 (it reads tsconfig paths). Verify with the smoke run below; if alias resolution fails, run with `npx tsx --tsconfig tsconfig.json`.

- [ ] **Step 5: Real-run smoke against Supabase** — `DOTENV_CONFIG_PATH=.env.local npx tsx scripts/ingest/run.ts`. Expected: `[flipp] flyers=~30 deals=thousands error=none`, `[fairway] flyers=1-2 deals=~100+ error=none`, `[wholefoods]` deals > 20 (or a recorded error that does not kill the run). Check in Supabase Table Editor (user's Chrome): `deals` populated. Run it a second time — row counts must NOT double (upsert idempotency).

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: ingest orchestrator with per-source isolation"`

---

### Task 9: Store branches + distance (Overpass)

**Files:**
- Create: `lib/geo.ts`, replace stub `lib/stores/overpass.ts`
- Test: `tests/geo.test.ts`, `tests/stores.test.ts`

**Interfaces:**
- Consumes: `getServiceClient`, `slugify`.
- Produces: `haversineMiles(a: {lat,lng}, b: {lat,lng}): number`; `matchBranches(merchants: {slug,name}[], elements: OsmElement[], home: {lat,lng})` (pure) and `syncStores(loc: LocationConfig): Promise<void>` which upserts `stores` rows with nearest-branch distance (null when unmatched).

- [ ] **Step 1: Failing tests** — `tests/geo.test.ts`:

```ts
import { expect, test } from 'vitest'
import { haversineMiles } from '@/lib/geo'

test('haversine: E 90th St to Union Square ~ 4.3 mi', () => {
  const d = haversineMiles({ lat: 40.7823, lng: -73.9525 }, { lat: 40.7359, lng: -73.9906 })
  expect(d).toBeGreaterThan(3.7); expect(d).toBeLessThan(4.9)
})
```

`tests/stores.test.ts`:

```ts
import { expect, test } from 'vitest'
import { matchBranches } from '@/lib/stores/overpass'

const home = { lat: 40.7823, lng: -73.9525 }
const elements = [
  { type: 'node', id: 1, lat: 40.7794, lon: -73.9497, tags: { name: 'Whole Foods Market', shop: 'supermarket' } },
  { type: 'node', id: 2, lat: 40.784, lon: -73.951, tags: { name: 'Morton Williams', shop: 'supermarket' } },
  { type: 'node', id: 3, lat: 40.7, lon: -74.0, tags: { name: 'Morton Williams', shop: 'supermarket' } },
  { type: 'way', id: 4, center: { lat: 40.779, lon: -73.955 }, tags: { name: 'Fairway Market', shop: 'supermarket' } },
]

test('matches nearest branch per merchant, null when absent', () => {
  const merchants = [
    { slug: 'whole-foods-market', name: 'Whole Foods Market' },
    { slug: 'morton-williams-supermarket', name: 'Morton Williams Supermarket' },
    { slug: 'fairway', name: 'Fairway Market' },
    { slug: 'wegmans', name: "Wegman's" },
  ]
  const rows = matchBranches(merchants, elements as never, home)
  const bySlug = Object.fromEntries(rows.map(r => [r.slug, r]))
  expect(bySlug['whole-foods-market'].distance_miles).toBeGreaterThan(0)
  expect(bySlug['morton-williams-supermarket'].lat).toBe(40.784)  // nearest of the two
  expect(bySlug['fairway'].distance_miles).toBeGreaterThan(0)     // way with center
  expect(bySlug['wegmans'].distance_miles).toBeNull()
})
```

- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** — `lib/geo.ts`:

```ts
export function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
```

`lib/stores/overpass.ts`:

```ts
import { haversineMiles } from '@/lib/geo'
import { slugify } from '@/lib/parse/normalize'
import { getServiceClient } from '@/lib/db'
import type { LocationConfig } from '@/lib/types'

export type OsmElement = {
  type: string; id: number
  lat?: number; lon?: number
  center?: { lat: number; lon: number }
  tags?: { name?: string; shop?: string; 'addr:street'?: string; 'addr:housenumber'?: string }
}

export interface StoreRow {
  slug: string; name: string; lat: number | null; lng: number | null
  branch_address: string | null; distance_miles: number | null
}

export function matchBranches(
  merchants: Array<{ slug: string; name: string }>,
  elements: OsmElement[],
  home: { lat: number; lng: number },
): StoreRow[] {
  const branches = elements
    .map(e => ({ lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon, tags: e.tags }))
    .filter((b): b is { lat: number; lng: number; tags: OsmElement['tags'] } => b.lat != null && b.lng != null && !!b.tags?.name)
  return merchants.map(m => {
    const mTokens = tokens(m.name)
    let best: { lat: number; lng: number; addr: string | null; d: number } | null = null
    for (const b of branches) {
      const bTokens = tokens(b.tags!.name!)
      const overlap = [...mTokens].filter(t => bTokens.has(t)).length
      const matches = overlap >= Math.min(2, mTokens.size) && overlap > 0
      if (!matches) continue
      const d = haversineMiles(home, b)
      if (!best || d < best.d) {
        const t = b.tags!
        const addr = t['addr:housenumber'] && t['addr:street'] ? `${t['addr:housenumber']} ${t['addr:street']}` : null
        best = { lat: b.lat, lng: b.lng, addr, d }
      }
    }
    return {
      slug: m.slug, name: m.name,
      lat: best?.lat ?? null, lng: best?.lng ?? null,
      branch_address: best?.addr ?? null,
      distance_miles: best ? Math.round(best.d * 100) / 100 : null,
    }
  })
}

function tokens(name: string): Set<string> {
  const STOP = new Set(['supermarket', 'supermarkets', 'market', 'markets', 'foods', 'food', 'inc', 'the', 'club'])
  return new Set(slugify(name).split('-').filter(t => t && !STOP.has(t)))
}

export async function syncStores(loc: LocationConfig): Promise<void> {
  const db = getServiceClient()
  const { data: merchants } = await db.from('flyers')
    .select('merchant_slug, merchant_name, source')
  if (!merchants?.length) return
  const unique = new Map(merchants.map(m => [m.merchant_slug, m]))
  const radiusMeters = 16_000 // ~10 mi cap; UI radius filters further
  const query = `[out:json][timeout:30];(node[shop~"supermarket|greengrocer"](around:${radiusMeters},${loc.lat},${loc.lng});way[shop~"supermarket|greengrocer"](around:${radiusMeters},${loc.lat},${loc.lng}););out center;`
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST', body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`)
  const { elements } = (await res.json()) as { elements: OsmElement[] }
  const rows = matchBranches(
    [...unique.values()].map(m => ({ slug: m.merchant_slug, name: m.merchant_name })),
    elements, loc,
  ).map(r => ({ ...r, source: unique.get(r.slug)!.source }))
  const { error } = await db.from('stores').upsert(rows, { onConflict: 'source,slug' })
  if (error) throw new Error(`stores upsert failed: ${error.message}`)
}
```

- [ ] **Step 4: Run tests until green, then re-run ingest smoke** (`DOTENV_CONFIG_PATH=.env.local npx tsx scripts/ingest/run.ts`) and check the `stores` table has distance values for close merchants (Morton Williams, Whole Foods should be < 1 mi).
- [ ] **Step 5: Commit** — `git commit -am "feat: store branch matching via Overpass with distances"`

---

### Task 10: GitHub repo + Actions workflow

**Files:**
- Create: `.github/workflows/ingest.yml`

**Interfaces:**
- Produces: private GitHub repo `deal-radar`; daily scheduled ingest with secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; manual trigger via `workflow_dispatch` (consumed by Task 11's refresh route).

- [ ] **Step 1: Workflow file**:

```yaml
name: ingest
on:
  schedule:
    - cron: '0 10 * * *'   # 06:00 America/New_York during EDT
  workflow_dispatch:

jobs:
  ingest:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx tsx scripts/ingest/run.ts
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

- [ ] **Step 2: Create repo, push, set secrets** (values from `.env.local`):

```bash
gh repo create deal-radar --private --source . --push
gh secret set SUPABASE_URL --body "$(grep '^SUPABASE_URL=' .env.local | cut -d= -f2-)"
gh secret set SUPABASE_SERVICE_ROLE_KEY --body "$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2-)"
```

- [ ] **Step 3: Trigger and verify** — `gh workflow run ingest && sleep 60 && gh run list --workflow ingest --limit 1`. Watch with `gh run watch`. Expected: green run; `ingest_runs` table gains fresh rows. If Whole Foods fails from the Actions IP (Amazon datacenter blocking), record the error in `ingest_runs` (already handled) and note it — the app still works with the other sources; mitigation options (launch args, residential runner later) go in a follow-up issue, not this plan.

- [ ] **Step 4: Commit** any fixes — `git commit -am "ci: daily ingest workflow"` (the workflow file itself was pushed in Step 2).

---

### Task 11: API routes

**Files:**
- Create: `app/api/deals/route.ts`, `app/api/meta/route.ts`, `app/api/geocode/route.ts`, `app/api/refresh/route.ts`, `lib/api/dealsQuery.ts`
- Test: `tests/dealsQuery.test.ts`

**Interfaces:**
- Consumes: `getServiceClient`.
- Produces (JSON contracts the UI consumes):
  - `GET /api/deals?q=&stores=a,b&category=&status=active|upcoming&sort=discount|price&limit=200` → `{ deals: DealRecord[] }` where `DealRecord` = deals row + `merchant_name`, `distance_miles`.
  - `GET /api/meta` → `{ stores: StoreMeta[], freshness: { source, finished_at, deal_count, error }[] }` with `StoreMeta = { slug, name, distance_miles, deal_count }`.
  - `GET /api/geocode?address=…` → `{ lat, lng, zip } | 404`.
  - `POST /api/refresh` → triggers `workflow_dispatch` (needs `GITHUB_DISPATCH_TOKEN` + `GITHUB_REPO` env), returns `{ ok: true }`.

- [ ] **Step 1: Failing test for the pure filter builder** — `tests/dealsQuery.test.ts`:

```ts
import { expect, test } from 'vitest'
import { parseDealsParams } from '@/lib/api/dealsQuery'

test('defaults', () => {
  expect(parseDealsParams(new URLSearchParams())).toEqual({
    q: null, stores: null, category: null, status: 'active', sort: 'discount', limit: 200,
  })
})

test('parses and clamps', () => {
  const p = parseDealsParams(new URLSearchParams('q=chicken&stores=aldi,fairway&category=meat&status=upcoming&sort=price&limit=9999'))
  expect(p).toEqual({ q: 'chicken', stores: ['aldi', 'fairway'], category: 'meat', status: 'upcoming', sort: 'price', limit: 500 })
})
```

- [ ] **Step 2: Run, verify fail; implement** — `lib/api/dealsQuery.ts`:

```ts
export interface DealsParams {
  q: string | null; stores: string[] | null; category: string | null
  status: 'active' | 'upcoming'; sort: 'discount' | 'price'; limit: number
}

export function parseDealsParams(sp: URLSearchParams): DealsParams {
  const status = sp.get('status') === 'upcoming' ? 'upcoming' : 'active'
  const sort = sp.get('sort') === 'price' ? 'price' : 'discount'
  const limit = Math.min(Math.max(Number(sp.get('limit')) || 200, 1), 500)
  const stores = sp.get('stores')?.split(',').map(s => s.trim()).filter(Boolean) ?? null
  return {
    q: sp.get('q')?.trim() || null,
    stores: stores?.length ? stores : null,
    category: sp.get('category')?.trim() || null,
    status, sort, limit,
  }
}
```

- [ ] **Step 3: Routes.** `app/api/deals/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/db'
import { parseDealsParams } from '@/lib/api/dealsQuery'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const p = parseDealsParams(req.nextUrl.searchParams)
  const db = getServiceClient()
  const now = new Date().toISOString()
  let q = db.from('deals').select('*, flyers!inner(merchant_name)')
  if (p.status === 'active') q = q.lte('valid_from', now).gte('valid_to', now)
  else q = q.gt('valid_from', now)
  if (p.stores) q = q.in('merchant_slug', p.stores)
  if (p.category) q = q.eq('category', p.category)
  if (p.q) q = q.or(`name.ilike.%${p.q}%,normalized_name.ilike.%${p.q}%`)
  if (p.sort === 'price') q = q.order('price', { ascending: true, nullsFirst: false })
  else q = q.order('discount_pct', { ascending: false, nullsFirst: false }).order('price', { ascending: true, nullsFirst: false })
  const { data, error } = await q.limit(p.limit)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { data: stores } = await db.from('stores').select('slug, distance_miles')
  const dist = new Map((stores ?? []).map(s => [s.slug, s.distance_miles]))
  const deals = (data ?? []).map(d => ({
    ...d,
    merchant_name: (d as { flyers?: { merchant_name?: string } }).flyers?.merchant_name ?? d.merchant_slug,
    distance_miles: dist.get(d.merchant_slug) ?? null,
    flyers: undefined,
  }))
  return NextResponse.json({ deals })
}
```

`app/api/meta/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = getServiceClient()
  const now = new Date().toISOString()
  const [{ data: stores }, { data: runs }, { data: active }] = await Promise.all([
    db.from('stores').select('slug, name, distance_miles'),
    db.from('ingest_runs').select('source, finished_at, deal_count, error').order('id', { ascending: false }).limit(9),
    db.from('deals').select('merchant_slug').lte('valid_from', now).gte('valid_to', now),
  ])
  const counts = new Map<string, number>()
  for (const d of active ?? []) counts.set(d.merchant_slug, (counts.get(d.merchant_slug) ?? 0) + 1)
  const latestBySource = new Map<string, NonNullable<typeof runs>[number]>()
  for (const r of runs ?? []) if (!latestBySource.has(r.source)) latestBySource.set(r.source, r)
  return NextResponse.json({
    stores: (stores ?? []).map(s => ({ ...s, deal_count: counts.get(s.slug) ?? 0 }))
      .filter(s => s.deal_count > 0)
      .sort((a, b) => (a.distance_miles ?? 99) - (b.distance_miles ?? 99)),
    freshness: [...latestBySource.values()],
  })
}
```

`app/api/geocode/route.ts` (US Census, free, no key):

```ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 })
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) return NextResponse.json({ error: 'geocoder unavailable' }, { status: 502 })
  const data = await res.json()
  const match = data?.result?.addressMatches?.[0]
  if (!match) return NextResponse.json({ error: 'address not found' }, { status: 404 })
  return NextResponse.json({
    lat: match.coordinates.y, lng: match.coordinates.x,
    zip: match.addressComponents?.zip ?? null,
  })
}
```

`app/api/refresh/route.ts`:

```ts
import { NextResponse } from 'next/server'

export async function POST() {
  const token = process.env.GITHUB_DISPATCH_TOKEN
  const repo = process.env.GITHUB_REPO // e.g. "ozansozuoz/deal-radar"
  if (!token || !repo) return NextResponse.json({ error: 'refresh not configured' }, { status: 501 })
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/ingest.yml/dispatches`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    body: JSON.stringify({ ref: 'main' }),
  })
  return res.status === 204
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: `GitHub ${res.status}` }, { status: 502 })
}
```

- [ ] **Step 4: Verify locally** — `npm run dev`, then `curl -s 'localhost:3000/api/deals?q=chicken' | head -c 500` (expect JSON deals), `curl -s 'localhost:3000/api/meta'`, `curl -s 'localhost:3000/api/geocode?address=174+E+90th+St+New+York+NY'` (expect lat/lng/zip 10128).
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: deals, meta, geocode, refresh API routes"`

---

### Task 12: UI

**Files:**
- Create: `lib/client/prefs.ts`, `components/SetupCard.tsx`, `components/Feed.tsx`, `components/DealCard.tsx`, `components/FlyerCrop.tsx`, `components/Chips.tsx`
- Modify: `app/page.tsx`, `app/layout.tsx` (title "Deal Radar", viewport meta)

**Interfaces:**
- Consumes: `/api/deals`, `/api/meta`, `/api/geocode` JSON contracts from Task 11.
- Produces: working mobile-first UI.

Design notes (follow, don't reinterpret): mobile-first single column; sticky top bar with search input + settings gear (reopens SetupCard); horizontal scrollable filter chips (stores with distance, then categories); deal cards in a 2-col grid on phones. Dark background (`bg-neutral-950`), light text, one accent color for prices (`text-emerald-400`). No component library — plain Tailwind.

- [ ] **Step 1:** `lib/client/prefs.ts`:

```ts
export interface Prefs {
  address: string; lat: number; lng: number; zip: string
  radiusMiles: number; enabledStores: string[] | null  // null = all
}

const KEY = 'deal-radar-prefs-v1'

export function loadPrefs(): Prefs | null {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') } catch { return null }
}
export function savePrefs(p: Prefs): void { localStorage.setItem(KEY, JSON.stringify(p)) }
```

- [ ] **Step 2:** `components/FlyerCrop.tsx` (percent-rect crop of a flyer page image):

```tsx
import type { CropRect } from '@/lib/types'

export function FlyerCrop({ crop, alt }: { crop: CropRect; alt: string }) {
  const posX = crop.w < 100 ? (crop.x / (100 - crop.w)) * 100 : 0
  const posY = crop.h < 100 ? (crop.y / (100 - crop.h)) * 100 : 0
  return (
    <div
      role="img" aria-label={alt}
      className="w-full rounded-lg bg-white"
      style={{
        aspectRatio: `${crop.w} / ${crop.h}`,
        backgroundImage: `url(${crop.image})`,
        backgroundSize: `${10000 / crop.w}% auto`,
        backgroundPosition: `${posX}% ${posY}%`,
      }}
    />
  )
}
```

- [ ] **Step 3:** `components/DealCard.tsx`:

```tsx
import type { CropRect } from '@/lib/types'
import { FlyerCrop } from './FlyerCrop'

export interface DealRecord {
  id: number; name: string; description: string | null
  price: number | null; original_price: number | null; prime_price: number | null
  unit: string | null; price_text: string | null; sale_story: string | null
  category: string; image_url: string | null; crop: CropRect | null
  merchant_slug: string; merchant_name: string; distance_miles: number | null
  valid_from: string | null; valid_to: string | null; discount_pct: number | null
}

export function DealCard({ deal }: { deal: DealRecord }) {
  const daysLeft = deal.valid_to ? Math.max(0, Math.ceil((+new Date(deal.valid_to) - Date.now()) / 86_400_000)) : null
  return (
    <div className="rounded-xl bg-neutral-900 p-3 flex flex-col gap-2">
      {deal.crop ? <FlyerCrop crop={deal.crop} alt={deal.name} />
        : deal.image_url ? <img src={deal.image_url} alt="" loading="lazy" className="w-full aspect-square object-contain rounded-lg bg-white" />
        : <div className="w-full aspect-square rounded-lg bg-neutral-800" />}
      <div className="text-sm font-medium leading-tight">{deal.name}</div>
      {deal.description && <div className="text-xs text-neutral-400 line-clamp-2">{deal.description}</div>}
      <div className="mt-auto flex items-baseline gap-2 flex-wrap">
        {deal.price != null ? (
          <>
            <span className="text-emerald-400 text-lg font-bold">${deal.price.toFixed(2)}{deal.unit ? `/${deal.unit}` : ''}</span>
            {deal.original_price != null && <span className="text-neutral-500 line-through text-sm">${deal.original_price.toFixed(2)}</span>}
            {deal.discount_pct != null && <span className="text-xs bg-emerald-900/60 text-emerald-300 rounded px-1.5 py-0.5">-{deal.discount_pct}%</span>}
          </>
        ) : deal.sale_story ? <span className="text-emerald-400 font-semibold text-sm">{deal.sale_story}</span>
          : deal.price_text ? <span className="text-emerald-400 font-semibold text-sm">{deal.price_text}</span>
          : null}
      </div>
      {deal.prime_price != null && <div className="text-xs text-sky-300">${deal.prime_price.toFixed(2)} with Prime</div>}
      <div className="flex justify-between text-xs text-neutral-400">
        <span>{deal.merchant_name}{deal.distance_miles != null ? ` · ${deal.distance_miles} mi` : ''}</span>
        {daysLeft != null && <span>{daysLeft === 0 ? 'ends today' : `${daysLeft}d left`}</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4:** `components/Chips.tsx`:

```tsx
export function Chips({ options, selected, onToggle }: {
  options: Array<{ value: string; label: string }>
  selected: string[] | null
  onToggle: (value: string) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
      {options.map(o => {
        const on = selected?.includes(o.value) ?? false
        return (
          <button key={o.value} onClick={() => onToggle(o.value)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs border ${on ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-neutral-700 text-neutral-300'}`}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5:** `components/SetupCard.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { savePrefs, type Prefs } from '@/lib/client/prefs'

export function SetupCard({ initial, onDone }: { initial: Prefs | null; onDone: (p: Prefs) => void }) {
  const [address, setAddress] = useState(initial?.address ?? '')
  const [radius, setRadius] = useState(initial?.radiusMiles ?? 1.5)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`)
      if (!res.ok) throw new Error((await res.json()).error ?? 'Could not find that address')
      const { lat, lng, zip } = await res.json()
      const prefs: Prefs = { address, lat, lng, zip: zip ?? '10128', radiusMiles: radius, enabledStores: null }
      savePrefs(prefs); onDone(prefs)
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong') }
    finally { setBusy(false) }
  }

  return (
    <div className="max-w-md mx-auto mt-16 rounded-2xl bg-neutral-900 p-6 flex flex-col gap-4">
      <h1 className="text-xl font-bold">📍 Where are you?</h1>
      <input value={address} onChange={e => setAddress(e.target.value)}
        placeholder="the home address (Upper East Side, NYC)"
        className="rounded-lg bg-neutral-800 px-3 py-2 text-sm outline-none focus:ring-2 ring-emerald-600" />
      <label className="text-sm text-neutral-300">
        Radius: <b>{radius} mi</b>
        <input type="range" min={0.5} max={10} step={0.5} value={radius}
          onChange={e => setRadius(Number(e.target.value))} className="w-full accent-emerald-500" />
      </label>
      {error && <div className="text-sm text-red-400">{error}</div>}
      <button onClick={submit} disabled={busy || !address.trim()}
        className="rounded-lg bg-emerald-600 py-2 font-semibold disabled:opacity-50">
        {busy ? 'Locating…' : 'Show my deals'}
      </button>
    </div>
  )
}
```

- [ ] **Step 6:** `components/Feed.tsx`:

```tsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import { DealCard, type DealRecord } from './DealCard'
import { Chips } from './Chips'
import type { Prefs } from '@/lib/client/prefs'

interface Meta {
  stores: Array<{ slug: string; name: string; distance_miles: number | null; deal_count: number }>
  freshness: Array<{ source: string; finished_at: string; deal_count: number; error: string | null }>
}

const CATEGORIES = ['produce', 'meat', 'seafood', 'dairy', 'bakery', 'frozen', 'beverages', 'pantry', 'snacks', 'household', 'personal-care']

export function Feed({ prefs, onOpenSetup }: { prefs: Prefs; onOpenSetup: () => void }) {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [deals, setDeals] = useState<DealRecord[]>([])
  const [q, setQ] = useState('')
  const [storeSel, setStoreSel] = useState<string[] | null>(prefs.enabledStores)
  const [catSel, setCatSel] = useState<string[] | null>(null)
  const [upcoming, setUpcoming] = useState(false)
  const [loading, setLoading] = useState(true)

  const inRadius = useMemo(() =>
    (meta?.stores ?? []).filter(s => s.distance_miles == null || s.distance_miles <= prefs.radiusMiles),
    [meta, prefs.radiusMiles])

  useEffect(() => { fetch('/api/meta').then(r => r.json()).then(setMeta) }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    const stores = storeSel ?? inRadius.map(s => s.slug)
    if (stores.length) params.set('stores', stores.join(','))
    if (catSel?.length === 1) params.set('category', catSel[0])
    params.set('status', upcoming ? 'upcoming' : 'active')
    setLoading(true)
    const t = setTimeout(() =>
      fetch(`/api/deals?${params}`).then(r => r.json())
        .then(d => setDeals(d.deals ?? [])).finally(() => setLoading(false)), 250)
    return () => clearTimeout(t)
  }, [q, storeSel, catSel, upcoming, inRadius])

  return (
    <div className="max-w-3xl mx-auto px-4 pb-16">
      <div className="sticky top-0 z-10 bg-neutral-950/95 backdrop-blur pt-4 pb-2 flex flex-col gap-2">
        <div className="flex gap-2 items-center">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search deals… (e.g. chicken)"
            className="flex-1 rounded-lg bg-neutral-800 px-3 py-2 text-sm outline-none focus:ring-2 ring-emerald-600" />
          <button onClick={() => setUpcoming(u => !u)}
            className={`rounded-lg px-3 py-2 text-xs border ${upcoming ? 'bg-sky-700 border-sky-500' : 'border-neutral-700 text-neutral-300'}`}>
            {upcoming ? 'Upcoming' : 'This week'}
          </button>
          <button onClick={onOpenSetup} aria-label="Settings" className="rounded-lg px-3 py-2 border border-neutral-700">⚙️</button>
        </div>
        <Chips
          options={inRadius.map(s => ({ value: s.slug, label: `${s.name}${s.distance_miles != null ? ` ${s.distance_miles}mi` : ''}` }))}
          selected={storeSel}
          onToggle={v => setStoreSel(cur => {
            const base = cur ?? []
            const next = base.includes(v) ? base.filter(x => x !== v) : [...base, v]
            return next.length ? next : null
          })} />
        <Chips options={CATEGORIES.map(c => ({ value: c, label: c }))} selected={catSel}
          onToggle={v => setCatSel(cur => (cur?.includes(v) ? null : [v]))} />
      </div>
      {loading ? <div className="text-center text-neutral-500 mt-20">Loading deals…</div>
        : deals.length === 0 ? <div className="text-center text-neutral-500 mt-20">No deals match. Widen the radius or clear filters.</div>
        : <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">{deals.map(d => <DealCard key={d.id} deal={d} />)}</div>}
      {meta && (
        <div className="mt-8 text-xs text-neutral-600">
          {meta.freshness.map(f => (
            <div key={f.source}>
              {f.source}: {f.error ? `⚠️ ${new Date(f.finished_at).toLocaleDateString()} (last good data may be older)` : `updated ${new Date(f.finished_at).toLocaleDateString()}, ${f.deal_count} deals`}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 7:** `app/page.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { SetupCard } from '@/components/SetupCard'
import { Feed } from '@/components/Feed'
import { loadPrefs, type Prefs } from '@/lib/client/prefs'

export default function Home() {
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const [ready, setReady] = useState(false)
  const [editing, setEditing] = useState(false)
  useEffect(() => { setPrefs(loadPrefs()); setReady(true) }, [])
  if (!ready) return null
  if (!prefs || editing) return <SetupCard initial={prefs} onDone={p => { setPrefs(p); setEditing(false) }} />
  return <Feed prefs={prefs} onOpenSetup={() => setEditing(true)} />
}
```

Update `app/layout.tsx` metadata: `title: 'Deal Radar'`, `description: 'Best supermarket deals near you'`, body class `bg-neutral-950 text-neutral-100 antialiased`.

- [ ] **Step 8: Verify in the browser** — `npm run dev`, open `http://localhost:3000` in the Claude browser pane: setup card renders → enter the home address → feed shows deals from multiple stores; Fairway cards show flyer crops with visible printed prices (visually confirm the crop math shows the right product region — if crops look offset, the coords interpretation x,y,z,w,h needs swapping to x,y,z,h,w; fix `parseCoords` and its test together). Search "chicken" filters. Store/category chips filter. Mobile viewport (resize 375px) looks right.
- [ ] **Step 9: Run all tests + build** — `npm test && npm run build` → green.
- [ ] **Step 10: Commit** — `git add -A && git commit -m "feat: setup flow, deals feed, search UI"`

---

### Task 13: Deploy + end-to-end verification

**Files:**
- Create: `tests/e2e/feed.spec.ts`, `playwright.config.ts`
- Modify: Vercel project settings (env), GitHub repo (secrets)

**Interfaces:**
- Consumes: everything.
- Produces: production URL with live data; green scheduled ingest; e2e test.

- [ ] **Step 1: Playwright e2e** — `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:3000' },
  webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true },
})
```

`tests/e2e/feed.spec.ts` (requires the DB to be populated — run after Task 8's real ingest):

```ts
import { expect, test } from '@playwright/test'

test('setup → feed → search', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder(/the home address/).fill('the home address (Upper East Side, NYC)')
  await page.getByRole('button', { name: /show my deals/i }).click()
  await expect(page.getByPlaceholder(/search deals/i)).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.grid > div').first()).toBeVisible({ timeout: 15_000 })
  await page.getByPlaceholder(/search deals/i).fill('chicken')
  await expect(page.locator('.grid > div').first()).toBeVisible({ timeout: 15_000 })
})
```

`npm i -D @playwright/test`; add script `"e2e": "playwright test"`. Run `npm run e2e` → 1 passed. (Vitest must ignore `tests/e2e` — add `exclude: ['tests/e2e/**']` to `vitest.config.ts` test options.)

- [ ] **Step 2: Deploy to Vercel** — `npx vercel link` (create project `deal-radar`), then set env vars and deploy:

```bash
npx vercel env add SUPABASE_URL production < <(grep '^SUPABASE_URL=' .env.local | cut -d= -f2-)
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production < <(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2-)
npx vercel --prod
```

If `vercel` needs login, pause and ask the user to run `npx vercel login`. For the refresh button: create a fine-grained GitHub PAT (user does this in their browser; scope: Actions read/write on `deal-radar` only) and `npx vercel env add GITHUB_DISPATCH_TOKEN production`, `npx vercel env add GITHUB_REPO production` (value `<user>/deal-radar`). Redeploy.

- [ ] **Step 3: Real-build verification (Operating Practices — do not skip):**
  1. Open the production URL on the desktop browser pane: complete setup with the real address; confirm feed loads with deals from at least Flipp merchants + Fairway (Whole Foods if CI ingest succeeded).
  2. Cross-check 3 prices against sources: one Flipp deal vs. the store's flyer on flipp.com, one Fairway crop vs. the flyer PDF page, one Whole Foods deal vs. wholefoodsmarket.com — prices must match exactly.
  3. `gh run list --workflow ingest --limit 1` → latest scheduled/dispatched run green; `ingest_runs` shows all three sources with recent `finished_at`.
  4. Confirm feed's freshness footer shows today's date for all sources (or a visible ⚠️ for any failed one).
- [ ] **Step 4: Commit + push everything** — `git add -A && git commit -m "test: e2e; chore: deploy config" && git push`.

---

## Self-Review Notes

- Spec coverage: setup flow (T12), radius (T9+T12 client-side filter), top deals (T11+T12), search (T11+T12), three adapters (T4–T6), flyer lifecycle upsert + active/upcoming (T8, T11), ingest_runs freshness UI (T8, T12), GH Actions daily (T10), refresh button (T11 route + wire a call to `/api/refresh` from the ⚙️ menu if desired — optional, deferred to Phase 2 UI polish), deploy + verification (T13). Phase 2 items (shopping list, history, watches, Fairway numeric prices) intentionally excluded.
- The Whole Foods CI-blocking risk is handled: per-source error isolation + freshness warnings; job fails only if all sources fail.
- Type consistency: `DealRecord` in `DealCard.tsx` mirrors the `deals` table + `merchant_name`/`distance_miles` added by the route; `CropRect` shared via `lib/types.ts`.
