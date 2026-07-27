// "Dinner from deals": env-gated Gemini generation, runs at the end of ingest.
import { getServiceClient } from '@/lib/db'

export interface DinnerIdea {
  title: string; emoji: string; description: string
  ingredients: Array<{ name: string; dealName?: string; store?: string; price?: number }>
  estCost: number
}

export async function generateDinnerIdeas(): Promise<void> {
  const key = process.env.GEMINI_API_KEY
  if (!key) { console.log('[dinner] no GEMINI_API_KEY — skipping'); return }
  const db = getServiceClient()
  const now = new Date().toISOString()
  const { data: deals } = await db.from('deals')
    .select('name, price, merchant_slug, category')
    .not('price', 'is', null)
    .lte('valid_from', now).gte('valid_to', now)
    .in('category', ['produce', 'meat', 'seafood', 'dairy', 'pantry'])
    .order('discount_pct', { ascending: false, nullsFirst: false })
    .limit(40)
  if (!deals?.length) { console.log('[dinner] no priced deals'); return }
  const { data: stores } = await db.from('stores').select('slug, name')
  const storeName = new Map((stores ?? []).map(s => [s.slug, s.name]))

  const dealList = deals.map(d =>
    `${d.name} — $${Number(d.price).toFixed(2)} at ${storeName.get(d.merchant_slug) ?? d.merchant_slug} (${d.category})`).join('\n')

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `These grocery items are on sale near me this week:\n\n${dealList}\n\nSuggest exactly 3 realistic weeknight dinner ideas that make the most of these sale items. Return ONLY a JSON array:\n[{"title":"...","emoji":"🍝","description":"one appetizing sentence","ingredients":[{"name":"...","dealName":"exact deal name from the list if used","store":"store name","price":4.99}],"estCost":14.5}]\nRules: each dinner should use 2-4 of the sale items (plus pantry basics); estCost sums the sale-item prices used; keep descriptions short and appetizing.`,
          }],
        }],
        generationConfig: { temperature: 0.4 },
      }),
      signal: AbortSignal.timeout(60_000),
    },
  )
  if (!res.ok) { console.error(`[dinner] Gemini HTTP ${res.status}`); return }
  const data = await res.json()
  const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
  const jsonText = text.replace(/^```(?:json)?/m, '').replace(/```\s*$/m, '').trim()
  let ideas: DinnerIdea[]
  try { ideas = JSON.parse(jsonText) } catch { console.error('[dinner] non-JSON response'); return }
  if (!Array.isArray(ideas) || ideas.length === 0) { console.error('[dinner] empty ideas'); return }
  const { error } = await db.from('suggestions').insert({ payload: { ideas: ideas.slice(0, 3) } })
  if (error) console.error('[dinner] insert failed:', error.message)
  else console.log(`[dinner] stored ${Math.min(ideas.length, 3)} ideas`)
}
