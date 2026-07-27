const MULTI = /(\d+)\s*(?:\/|for)\s*\$\s*(\d+(?:\.\d+)?)/i
const SINGLE = /\$?\s*(\d+(?:\.\d+)?)/
const RANGE = /\$?\d+(?:\.\d+)?\s*(?:to|–|—)\s*\$\d/i

export function parsePrice(input: string | number | null | undefined): number | null {
  if (input == null) return null
  if (typeof input === 'number') return Number.isFinite(input) ? input : null
  const text = input.trim()
  if (!text) return null
  if (RANGE.test(text)) return null
  if (/%\s*off/i.test(text) || /buy\s*\d/i.test(text)) return null
  const multi = MULTI.exec(text)
  if (multi) {
    const qty = Number(multi[1])
    const total = Number(multi[2])
    return qty > 0 ? round2(total / qty) : null
  }
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
