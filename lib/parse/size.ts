export interface Size { qty: number; unit: 'oz' | 'lb' | 'l' | 'ct' }

const SIZE_RE = /(\d+(?:\.\d+)?)(?:\s*(?:to|–|-)\s*(\d+(?:\.\d+)?))?[\s-]*(?:fl\.?[\s-]*)?(oz|lbs?|liters?|litres?|ml|ct|count|pks?|packs?|gallons?|gal|quarts?|qt|pints?|l)\b/i

export function parseSize(text: string | null | undefined): Size | null {
  if (!text) return null
  if (/half[\s-]+gal/i.test(text)) return { qty: 64, unit: 'oz' }
  const m = SIZE_RE.exec(text)
  if (!m) return null
  const qty = Math.max(Number(m[1]), m[2] ? Number(m[2]) : 0)
  if (!Number.isFinite(qty) || qty <= 0) return null
  const raw = m[3].toLowerCase()
  if (raw === 'oz') return { qty, unit: 'oz' }
  if (raw.startsWith('lb')) return { qty, unit: 'lb' }
  if (raw.startsWith('liter') || raw.startsWith('litre') || raw === 'l') return { qty, unit: 'l' }
  if (raw === 'ml') return { qty: round3(qty / 1000), unit: 'l' }
  if (raw === 'ct' || raw === 'count' || raw.startsWith('pk') || raw.startsWith('pack')) return { qty, unit: 'ct' }
  if (raw.startsWith('gal')) return { qty: qty * 128, unit: 'oz' }
  if (raw.startsWith('quart') || raw === 'qt') return { qty: qty * 32, unit: 'oz' }
  if (raw.startsWith('pint')) return { qty: qty * 16, unit: 'oz' }
  return null
}

export function unitPrice(price: number | null | undefined, size: Size | null | undefined): number | null {
  if (price == null || !size || size.qty <= 0) return null
  return Math.round((price / size.qty) * 100) / 100
}

function round3(n: number): number { return Math.round(n * 1000) / 1000 }
