import { expect, test } from 'vitest'
import { mergePreservedPrices } from '@/lib/ingest/preserve'

test('fills null prices from existing rows without touching fresh ones', () => {
  const rows = [
    { external_id: 'a', price: null, price_text: null, unit_price: null },
    { external_id: 'b', price: 2.99, price_text: '$2.99', unit_price: null },
    { external_id: 'c', price: null, price_text: null, unit_price: null },
  ]
  const existing = [
    { external_id: 'a', price: 4.99, price_text: '$4.99', unit_price: 0.5 },
    { external_id: 'b', price: 1.11, price_text: '$1.11', unit_price: null },
  ]
  const merged = mergePreservedPrices(rows as never, existing as never)
  expect(merged[0]).toMatchObject({ external_id: 'a', price: 4.99, price_text: '$4.99', unit_price: 0.5 })
  expect(merged[1]).toMatchObject({ external_id: 'b', price: 2.99 })  // fresh price wins
  expect(merged[2]).toMatchObject({ external_id: 'c', price: null }) // nothing to preserve
})
