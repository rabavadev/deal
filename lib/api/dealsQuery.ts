export interface DealsParams {
  q: string | null; stores: string[] | null; category: string | null
  status: 'active' | 'upcoming'; sort: 'discount' | 'price' | 'ending'; limit: number
}

export function parseDealsParams(sp: URLSearchParams): DealsParams {
  const status = sp.get('status') === 'upcoming' ? 'upcoming' : 'active'
  const sortParam = sp.get('sort')
  const sort = sortParam === 'price' ? 'price' : sortParam === 'ending' ? 'ending' : 'discount'
  const limit = Math.min(Math.max(Number(sp.get('limit')) || 200, 1), 500)
  const stores = sp.get('stores')?.split(',').map(s => s.trim()).filter(Boolean) ?? null
  return {
    q: sp.get('q')?.trim() || null,
    stores: stores?.length ? stores : null,
    category: sp.get('category')?.trim() || null,
    status, sort, limit,
  }
}
