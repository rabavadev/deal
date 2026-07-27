import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 })
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) return NextResponse.json({ error: 'geocoder unavailable' }, { status: 502 })
  const data = await res.json()
  const match = data?.result?.addressMatches?.[0]
  if (!match) return NextResponse.json({ error: 'address not found' }, { status: 404 })
  return NextResponse.json({
    lat: match.coordinates.y, lng: match.coordinates.x,
    zip: match.addressComponents?.zip ?? null,
  })
}
