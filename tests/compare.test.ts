import { expect, test } from 'vitest'
import { compareList, matchesForItem } from '@/lib/compare'

const deals = [
  { name: 'Boneless Chicken Breast', normalized_name: 'boneless chicken breast', merchant_slug: 'aldi', merchant_name: 'Aldi', price: 2.49 },
  { name: 'Chicken Breast Family Pack', normalized_name: 'chicken breast family pack', merchant_slug: 'c-town', merchant_name: 'C Town', price: 2.99 },
  { name: 'Whole Milk Gallon', normalized_name: 'whole milk gallon', merchant_slug: 'c-town', merchant_name: 'C Town', price: 3.49 },
  { name: 'Organic Whole Milk', normalized_name: 'organic whole milk', merchant_slug: 'wholefoods', merchant_name: 'Whole Foods', price: 4.99 },
  { name: 'Bananas', normalized_name: 'bananas', merchant_slug: 'aldi', merchant_name: 'Aldi', price: 0.49 },
  { name: 'Frozen Chicken Nuggets', normalized_name: 'frozen chicken nuggets', merchant_slug: 'aldi', merchant_name: 'Aldi', price: 5.99 },
] as never[]

test('matchesForItem finds relevant deals, cheapest first', () => {
  const m = matchesForItem('chicken breast', deals)
  expect(m.map(d => (d as { merchant_slug: string }).merchant_slug)).toEqual(['aldi', 'c-town'])
})

test('matchesForItem requires all meaningful tokens', () => {
  expect(matchesForItem('chicken breast', deals)).toHaveLength(2) // nuggets excluded
  expect(matchesForItem('oat milk', deals)).toHaveLength(0)       // 'oat' missing
})

test('compareList computes per-store totals and best plans', () => {
  const r = compareList(['chicken breast', 'whole milk', 'bananas'], deals)
  expect(r.items).toHaveLength(3)
  const aldi = r.stores.find(s => s.slug === 'aldi')!
  expect(aldi.matched).toBe(2)             // chicken + bananas
  expect(aldi.total).toBeCloseTo(2.98)
  const ctown = r.stores.find(s => s.slug === 'c-town')!
  expect(ctown.matched).toBe(2)            // chicken + milk
  expect(r.bestSingle!.slug).toBe('aldi')  // tie on matched, cheaper total
  expect(r.bestPair).toBeTruthy()
  expect(r.bestPair!.covered).toBe(3)      // aldi + c-town covers everything
})
