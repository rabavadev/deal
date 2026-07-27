import { expect, test } from 'vitest'
import { readFileSync } from 'fs'
import { applyItemDetail } from '@/lib/sources/flipp'
import type { DealInput } from '@/lib/types'

const detail = JSON.parse(readFileSync('fixtures/flipp-item-detail-limes.json', 'utf8'))

function deal(over: Partial<DealInput> = {}): DealInput {
  return {
    source: 'flipp', externalId: '1029336028', merchantSlug: 'fine-fare-supermarkets',
    name: 'Limes', price: 1, priceText: '1.0', category: 'produce',
    validFrom: null, validTo: null, ...over,
  }
}

test('multi-buy "4/" becomes per-unit price with clear text', () => {
  const d = applyItemDetail(deal(), detail.item)
  expect(d.price).toBe(0.25)
  expect(d.priceText).toBe('4/$1.00')
  expect(d.saleStory).toBe('4 for $1.00')
})

test('plain items keep their price and gain nothing bogus', () => {
  const d = applyItemDetail(deal({ price: 2.99, priceText: '2.99' }), {
    ...detail.item, pre_price_text: null, current_price: '2.99',
  })
  expect(d.price).toBe(2.99)
  expect(d.saleStory ?? null).toBeNull()
})

test('original price and unit flow through when present', () => {
  const d = applyItemDetail(deal(), {
    ...detail.item, pre_price_text: null, current_price: '3.99', original_price: '5.99', price_text: 'lb',
  })
  expect(d.originalPrice).toBe(5.99)
  expect(d.unit).toBe('lb')
})

test('"2 for" phrasing also parses', () => {
  const d = applyItemDetail(deal(), { ...detail.item, pre_price_text: '2 for', current_price: '7.0' })
  expect(d.price).toBe(3.5)
  expect(d.priceText).toBe('2/$7.00')
})
