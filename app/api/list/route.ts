import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/db'

export const dynamic = 'force-dynamic'

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function newCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map(b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')?.toUpperCase()
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 })
  const db = getServiceClient()
  const { data, error } = await db.from('list_items').select('text, created_at')
    .eq('code', code).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const texts: string[] = (Array.isArray(body.texts) ? body.texts : [body.text])
    .filter((t: unknown): t is string => typeof t === 'string' && !!t.trim())
    .map((t: string) => t.trim().slice(0, 120))
  let code: string | null = typeof body.code === 'string' ? body.code.toUpperCase() : null
  const db = getServiceClient()
  if (!code) {
    code = newCode()
    const { error } = await db.from('lists').insert({ code })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (texts.length) {
    const { error } = await db.from('list_items')
      .upsert(texts.map(text => ({ code, text })), { onConflict: 'code,text' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ code })
}

export async function DELETE(req: NextRequest) {
  const { code, text } = await req.json().catch(() => ({}))
  if (!code || !text) return NextResponse.json({ error: 'code and text required' }, { status: 400 })
  const db = getServiceClient()
  const { error } = await db.from('list_items').delete()
    .eq('code', String(code).toUpperCase()).eq('text', text)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
