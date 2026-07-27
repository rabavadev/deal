import type { LocationConfig } from '@/lib/types'

// The location the daily ingest scans around. Override via env (see .env.example) —
// the defaults point at Midtown Manhattan as a neutral demo location.
export const DEFAULT_LOCATION: LocationConfig = {
  address: process.env.INGEST_ADDRESS ?? 'New York, NY',
  postalCode: process.env.INGEST_POSTAL_CODE ?? '10001',
  lat: Number(process.env.INGEST_LAT ?? 40.7484),
  lng: Number(process.env.INGEST_LNG ?? -73.9857),
  radiusMiles: Number(process.env.INGEST_RADIUS_MILES ?? 2),
  // find yours with: npx tsx scripts/wf-find-store.ts <store-page-slug>
  wholeFoodsStoreId: process.env.INGEST_WF_STORE_ID ? Number(process.env.INGEST_WF_STORE_ID) : null,
}
