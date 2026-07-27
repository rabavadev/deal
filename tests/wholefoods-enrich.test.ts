import { expect, test } from 'vitest'
import { readFileSync } from 'fs'
import { enrichWfDeals, flattenWfProducts } from '@/lib/sources/wholefoods-parse'
import type { DealInput } from '@/lib/types'

const batches = JSON.parse(readFileSync('fixtures/wholefoods-products.json', 'utf8'))

function deal(name: string): DealInput {
  return {
    source: 'wholefoods', externalId: 'x-' + name, merchantSlug: 'whole-foods-market',
    name, category: 'produce', validFrom: null, validTo: null, imageUrl: null,
  }
}

test('flattenWfProducts pulls products out of captured batches', () => {
  const products = flattenWfProducts(batches)
  expect(products.length).toBeGreaterThan(5)
  expect(products[0]).toHaveProperty('name')
  expect(products[0]).toHaveProperty('productImages')
})

test('enrichWfDeals fills images by name match', () => {
  const deals = [deal('Organic Yellow Nectarines'), deal('Zebra Print Toaster')]
  const enriched = enrichWfDeals(deals, flattenWfProducts(batches))
  expect(enriched[0].imageUrl).toContain('media-amazon.com')
  expect(enriched[1].imageUrl ?? null).toBeNull()  // no bogus match
})
