import { fetchJson } from '@/lib/http'
import { parsePrice, parseUnit } from '@/lib/parse/price'
import { categorize } from '@/lib/parse/category'
import { slugify } from '@/lib/parse/normalize'
import type { DealInput, DealSource, FlyerInput, LocationConfig } from '@/lib/types'

const BASE = 'https://backflipp.wishabi.com/flipp'

type FlippFlyer = {
  id: number; merchant: string; name: string
  valid_from: string | null; valid_to: string | null
  categories: string[] | null
  merchant_logo: string | null
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
      logoUrl: f.merchant_logo ?? null,
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

// ---- per-item detail enrichment (multi-buy prices like "4/$1") ----
// The flyer feed drops multi-buy prefixes; only /flipp/items/{id} has them.
// Fetched selectively (nearby stores) to keep request volume sane.

export interface FlippItemDetail {
  pre_price_text?: string | null
  price_text?: string | null       // here this is the unit: "ea" | "lb" | …
  current_price?: string | number | null
  original_price?: string | number | null
  sale_story?: string | null
  description?: string | null
}

export function applyItemDetail(deal: DealInput, detail: FlippItemDetail): DealInput {
  const out = { ...deal }
  const total = parsePrice(detail.current_price ?? null)
  const multi = /^(\d+)\s*(?:\/|for)\s*$/i.exec((detail.pre_price_text ?? '').trim())
  if (multi && total != null) {
    const qty = Number(multi[1])
    if (qty > 1) {
      out.price = Math.round((total / qty) * 100) / 100
      out.priceText = `${qty}/$${total.toFixed(2)}`
      out.saleStory = `${qty} for $${total.toFixed(2)}`
    }
  } else if (total != null && out.price == null) {
    out.price = total
  }
  const orig = parsePrice(detail.original_price ?? null)
  if (orig != null && out.originalPrice == null) out.originalPrice = orig
  const unit = parseUnit(detail.price_text ?? null)
  if (unit && !out.unit) out.unit = unit
  if (detail.sale_story && !out.saleStory) out.saleStory = detail.sale_story
  if (detail.description && !out.description) out.description = detail.description
  return out
}

export async function enrichFlippDeals(deals: DealInput[], concurrency = 8): Promise<DealInput[]> {
  const out = [...deals]
  let i = 0
  async function worker() {
    while (i < out.length) {
      const idx = i++
      try {
        const payload = await fetchJson<{ item: FlippItemDetail }>(`${BASE}/items/${out[idx].externalId}`)
        if (payload?.item) out[idx] = applyItemDetail(out[idx], payload.item)
      } catch { /* keep the un-enriched deal */ }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  return out
}

export const flippSource: DealSource = {
  id: 'flipp',
  async fetchFlyers(loc: LocationConfig) {
    const payload = await fetchJson(`${BASE}/flyers?locale=en-us&postal_code=${loc.postalCode}`)
    return mapFlippFlyers(payload)
  },
  async fetchDeals(flyer: FlyerInput) {
    const payload = await fetchJson(`${BASE}/flyers/${flyer.externalId}?locale=en-us`)
    return mapFlippItems(flyer, payload)
  },
}
