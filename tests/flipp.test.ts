import { expect, test } from 'vitest'
import { readFileSync } from 'fs'
import { mapFlippFlyers, mapFlippItems } from '@/lib/sources/flipp'

const flyersPayload = JSON.parse(readFileSync('fixtures/flipp-flyers-10128.json', 'utf8'))
const itemsPayload = JSON.parse(readFileSync('fixtures/flipp-flyer-8054670.json', 'utf8'))

test('mapFlippFlyers keeps only grocery flyers and maps fields', () => {
  const flyers = mapFlippFlyers(flyersPayload)
  expect(flyers.length).toBeGreaterThan(10)
  for (const f of flyers) {
    expect(f.source).toBe('flipp')
    expect(f.externalId).toMatch(/^\d+$/)
    expect(f.merchantSlug).toMatch(/^[a-z0-9-]+$/)
    expect(f.validFrom).toBeTruthy()
    expect(f.validTo).toBeTruthy()
  }
  expect(flyers.some(f => f.merchantSlug === 'aldi')).toBe(true)
  // non-grocery merchants excluded
  expect(flyers.some(f => f.merchantSlug === 'best-buy')).toBe(false)
})

test('mapFlippItems maps deals with parsed prices', () => {
  const flyer = mapFlippFlyers(flyersPayload).find(f => f.externalId === '8054670')
    ?? mapFlippFlyers(flyersPayload)[0]
  const deals = mapFlippItems(flyer, itemsPayload)
  expect(deals.length).toBe(150)
  const ragu = deals.find(d => d.name.toLowerCase().includes('rag'))
  expect(ragu?.price).toBe(3.99)
  expect(ragu?.category).toBe('pantry')
  expect(ragu?.imageUrl).toContain('wishabi')
  expect(ragu?.validTo).toBeTruthy()
  for (const d of deals) expect(d.externalId).toMatch(/^\d+$/)
})
