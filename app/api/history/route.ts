import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')?.trim()
  const store = req.nextUrl.searchParams.get('store')?.trim()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const db = getServiceClient()
  let q = db.from('deals')
    .select('valid_from, valid_to, price, original_price, price_text')
    .eq('normalized_name', name)
    .order('valid_from', { ascending: true })
    .limit(104)
  if (store) q = q.eq('merchant_slug', store)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // one point per week window
  const seen = new Set<string>()
  const points = (data ?? []).filter(d => {
    const key = `${d.valid_from}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return NextResponse.json({ points })
}
