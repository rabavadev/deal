import { expect, test } from 'vitest'
import { dealRow, flyerRow } from '@/lib/ingest/upsert'
import type { DealInput, FlyerInput } from '@/lib/types'

const flyer: FlyerInput = {
  source: 'flipp', externalId: '8054670', merchantSlug: 'extra-supermarket',
  merchantName: 'Extra Supermarket', title: 'Indexed Bi-Weekly',
  validFrom: '2026-07-24T00:00:00-04:00', validTo: '2026-08-06T23:59:59-04:00',
}

test('flyerRow maps to snake_case', () => {
  const row = flyerRow(flyer)
  expect(row).toMatchObject({
    source: 'flipp', external_id: '8054670', merchant_slug: 'extra-supermarket',
    merchant_name: 'Extra Supermarket', valid_from: flyer.validFrom, valid_to: flyer.validTo,
  })
  expect(row.last_seen).toBeTruthy()
})

test('dealRow maps, computes normalized_name, keeps crop json', () => {
  const deal: DealInput = {
    source: 'fairway', externalId: '16155546', merchantSlug: 'fairway',
    name: 'Outshine Fruit Bars', category: 'frozen',
    crop: { image: 'https://x/p1.jpeg', x: 26, y: 76, w: 24, h: 19 },
    validFrom: null, validTo: '2026-07-30T23:59',
  }
  const row = dealRow(deal, 42)
  expect(row).toMatchObject({
    flyer_id: 42, external_id: '16155546', name: 'Outshine Fruit Bars',
    normalized_name: 'outshine fruit bars', category: 'frozen',
  })
  expect(row.crop).toEqual(deal.crop)
  expect(row.price ?? null).toBeNull()
})
