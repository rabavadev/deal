import { expect, test } from 'vitest'
import { applyExtractedPrices } from '@/lib/sources/fairway-prices'
import type { DealInput } from '@/lib/types'

function deal(name: string, price: number | null = null): DealInput {
  return {
    source: 'fairway', externalId: 'x-' + name, merchantSlug: 'fairway',
    name, price, category: 'other', validFrom: null, validTo: null,
  }
}

const extracted = [
  { title: 'Outshine Fruit Bars', price: 4.99 },
  { title: 'Fresh Strawberries 1 lb', price: 2.99 },
  { title: 'Fage Total Greek Yogurt', price: 5.99 },
]

test('fills prices by fuzzy title match', () => {
  const deals = applyExtractedPrices([deal('Outshine Fruit Bars'), deal('Fresh Strawberries')], extracted)
  expect(deals[0].price).toBe(4.99)
  expect(deals[1].price).toBe(2.99)
  expect(deals[1].priceText).toBe('$2.99')
})

test('does not overwrite existing prices or force weak matches', () => {
  const deals = applyExtractedPrices([deal('Outshine Fruit Bars', 1.11), deal('Zebra Toaster')], extracted)
  expect(deals[0].price).toBe(1.11)
  expect(deals[1].price).toBeNull()
})

test('ignores garbage extractions', () => {
  const deals = applyExtractedPrices([deal('Weird Item')], [{ title: 'Weird Item', price: 9999 }])
  expect(deals[0].price).toBeNull()
})
