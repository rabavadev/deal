// Shopping-list comparison over active deals. Pure functions, unit-tested.

export interface CompareDeal {
  name: string; normalized_name: string
  merchant_slug: string; merchant_name: string
  price: number | null
}

export interface ItemResult {
  text: string
  best: CompareDeal | null            // cheapest match anywhere
  byStore: Map<string, CompareDeal>   // cheapest match per store
}

export interface StoreTotal { slug: string; name: string; matched: number; total: number }

export interface CompareResult {
  items: ItemResult[]
  stores: StoreTotal[]                                    // sorted: most matched, then cheapest
  bestSingle: StoreTotal | null
  bestPair: { slugs: [string, string]; names: [string, string]; covered: number; total: number } | null
}

const STOP = new Set(['the', 'a', 'of', 'and', 'or', 'fresh', 'organic'])

function tokens(s: string): string[] {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .map(t => t.replace(/s$/, ''))
    .filter(t => t.length > 1 && !STOP.has(t))
}

/** Deals whose name contains every meaningful token of the item, cheapest first. */
export function matchesForItem(itemText: string, deals: CompareDeal[]): CompareDeal[] {
  const want = tokens(itemText)
  if (want.length === 0) return []
  return deals
    .filter(d => d.price != null)
    .filter(d => {
      const have = new Set(tokens(d.normalized_name || d.name))
      return want.every(t => have.has(t))
    })
    .sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9))
}

export function compareList(itemTexts: string[], deals: CompareDeal[]): CompareResult {
  const items: ItemResult[] = itemTexts.map(text => {
    const matches = matchesForItem(text, deals)
    const byStore = new Map<string, CompareDeal>()
    for (const m of matches) if (!byStore.has(m.merchant_slug)) byStore.set(m.merchant_slug, m)
    return { text, best: matches[0] ?? null, byStore }
  })

  const storeNames = new Map<string, string>()
  for (const it of items) for (const [slug, d] of it.byStore) storeNames.set(slug, d.merchant_name)

  const stores: StoreTotal[] = [...storeNames.entries()].map(([slug, name]) => {
    let matched = 0, total = 0
    for (const it of items) {
      const d = it.byStore.get(slug)
      if (d?.price != null) { matched++; total += d.price }
    }
    return { slug, name, matched, total: round2(total) }
  }).sort((a, b) => b.matched - a.matched || a.total - b.total)

  const bestSingle = stores[0] ?? null

  let bestPair: CompareResult['bestPair'] = null
  for (let i = 0; i < stores.length; i++) {
    for (let j = i + 1; j < stores.length; j++) {
      let covered = 0, total = 0
      for (const it of items) {
        const a = it.byStore.get(stores[i].slug)?.price
        const b = it.byStore.get(stores[j].slug)?.price
        const min = a != null && b != null ? Math.min(a, b) : a ?? b
        if (min != null) { covered++; total += min }
      }
      total = round2(total)
      if (!bestPair || covered > bestPair.covered || (covered === bestPair.covered && total < bestPair.total)) {
        bestPair = {
          slugs: [stores[i].slug, stores[j].slug],
          names: [stores[i].name, stores[j].name],
          covered, total,
        }
      }
    }
  }

  return { items, stores, bestSingle, bestPair }
}

function round2(n: number): number { return Math.round(n * 100) / 100 }
