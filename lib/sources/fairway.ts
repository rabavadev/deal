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
    let deals = mapFairwayRegions(flyer, regions, pages)
    if (process.env.GEMINI_API_KEY) {
      const { applyExtractedPrices, extractPricesFromImage } = await import('./fairway-prices')
      // sequential with pacing — free-tier Gemini rate-limits parallel calls
      const extracted: Awaited<ReturnType<typeof extractPricesFromImage>> = []
      for (const [i, p] of pages.entries()) {
        if (i > 0) await new Promise(r => setTimeout(r, 10_000))
        extracted.push(...await extractPricesFromImage(p.image).catch(() => []))
      }
      if (extracted.length) deals = applyExtractedPrices(deals, extracted)
    }
    return deals
  },
}
