// Optional numeric-price extraction for Fairway flyer pages.
// Runs ONLY when GEMINI_API_KEY is set (free-tier key; ~7 images/week).
// Without it, Fairway deals keep their crop-only display — nothing breaks.
import type { DealInput } from '@/lib/types'

export interface ExtractedPrice { title: string; price: number }

const STOP = new Set(['the', 'a', 'of', 'and', 'or', 'fresh', 'organic', 'any', 'variety'])

function tokens(s: string): string[] {
  return [...new Set(
    s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
      .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
      .filter(t => t.length > 2 && !STOP.has(t)),
  )]
}

function tokenMatches(a: string, b: string): boolean {
  if (a === b) return true
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  return short.length >= 4 && long.startsWith(short) && long.length - short.length <= 2
}

/** Fill deal.price from extracted {title, price} pairs by fuzzy title match. Pure. */
export function applyExtractedPrices(deals: DealInput[], extracted: ExtractedPrice[]): DealInput[] {
  const indexed = extracted
    .filter(e => e.title && Number.isFinite(e.price) && e.price > 0 && e.price < 500)
    .map(e => ({ e, tokens: tokens(e.title) }))
  return deals.map(d => {
    if (d.price != null) return d
    const dTokens = tokens(d.name)
    if (dTokens.length === 0) return d
    let best: { e: ExtractedPrice; score: number } | null = null
    for (const { e, tokens: eTokens } of indexed) {
      const overlap = dTokens.filter(t => eTokens.some(et => tokenMatches(t, et))).length
      const score = overlap / dTokens.length
      if (score > (best?.score ?? 0)) best = { e, score }
    }
    if (best && best.score >= 0.7) {
      return { ...d, price: best.e.price, priceText: `$${best.e.price.toFixed(2)}` }
    }
    return d
  })
}

/** Extract {title, price} pairs from one flyer page image via Gemini (free tier). */
export async function extractPricesFromImage(imageUrl: string): Promise<ExtractedPrice[]> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return []
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
  const img = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) })
  if (!img.ok) return []
  const b64 = Buffer.from(await img.arrayBuffer()).toString('base64')
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: 'image/jpeg', data: b64 } },
            { text: 'This is a supermarket flyer page. List every product that has a visible price. Return ONLY a JSON array like [{"title":"Product Name","price":4.99}]. Use the per-unit dollar price (for "2/$5" use 2.5). Skip products without a clear numeric price.' },
          ],
        }],
        generationConfig: { temperature: 0 },
      }),
      signal: AbortSignal.timeout(60_000),
    },
  )
  if (!res.ok) {
    console.error(`Gemini extraction failed: HTTP ${res.status}`)
    return []
  }
  const data = await res.json()
  const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
  const jsonText = text.replace(/^```(?:json)?/m, '').replace(/```\s*$/m, '').trim()
  try {
    const arr = JSON.parse(jsonText)
    return Array.isArray(arr) ? arr : []
  } catch {
    console.error('Gemini extraction returned non-JSON')
    return []
  }
}
