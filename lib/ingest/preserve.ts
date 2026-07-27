// Extraction-sourced prices (Fairway via Gemini) are lossy: a rate-limited page
// yields null prices that would otherwise overwrite last run's good values.
// Keep the previously-stored price when the new row has none.

interface PriceFields { external_id: string; price: number | null; price_text: string | null; unit_price: number | null }

export function mergePreservedPrices<T extends PriceFields>(
  rows: T[],
  existing: Array<Pick<PriceFields, 'external_id' | 'price' | 'price_text' | 'unit_price'>>,
): T[] {
  const byId = new Map(existing.map(e => [e.external_id, e]))
  return rows.map(r => {
    if (r.price != null) return r
    const prev = byId.get(r.external_id)
    if (!prev || prev.price == null) return r
    return { ...r, price: prev.price, price_text: prev.price_text, unit_price: prev.unit_price }
  })
}
