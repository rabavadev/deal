import { NextResponse } from 'next/server'

export async function POST() {
  const token = process.env.GITHUB_DISPATCH_TOKEN
  const repo = process.env.GITHUB_REPO // e.g. "ozansozuozgit/deal-radar"
  if (!token || !repo) return NextResponse.json({ error: 'refresh not configured' }, { status: 501 })
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/ingest.yml/dispatches`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    body: JSON.stringify({ ref: 'main' }),
  })
  return res.status === 204
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: `GitHub ${res.status}` }, { status: 502 })
}
