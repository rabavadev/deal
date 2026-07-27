import { expect, test } from 'vitest'
import { readFileSync } from 'fs'
import { mapFairwayCatalogues, mapFairwayRegions, parseCoords } from '@/lib/sources/fairway'
import type { FlyerInput } from '@/lib/types'

const pages = JSON.parse(readFileSync('fixtures/fairway-pages-16063900.json', 'utf8'))
const regions = JSON.parse(readFileSync('fixtures/fairway-regions-16063900.json', 'utf8'))

test('parseCoords', () => {
  expect(parseCoords('26.03,76.29,1000001,24.39,18.96')).toEqual({ x: 26.03, y: 76.29, w: 24.39, h: 18.96 })
  expect(parseCoords('bad')).toBeNull()
})

const flyer: FlyerInput = {
  source: 'fairway', externalId: '16063900', merchantSlug: 'fairway', merchantName: 'Fairway Market',
  title: 'Weekly Ad July 24th to July 30th', validFrom: '2026-07-23T00:00', validTo: '2026-07-30T23:59',
}

test('mapFairwayRegions produces deals with crops', () => {
  const deals = mapFairwayRegions(flyer, regions, pages)
  expect(deals.length).toBeGreaterThan(80)
  const outshine = deals.find(d => d.name === 'Outshine Fruit Bars')
  expect(outshine).toBeDefined()
  expect(outshine!.description).toContain('Any Variety')
  expect(outshine!.crop).toBeTruthy()
  expect(outshine!.crop!.image).toContain('cloudfront')
  expect(outshine!.crop!.w).toBeGreaterThan(0)
  expect(outshine!.validTo).toBe(flyer.validTo)
  // no numeric prices in Phase 1 for Fairway
  expect(outshine!.price ?? null).toBeNull()
})

test('mapFairwayCatalogues maps validity', () => {
  const catalogues = mapFairwayCatalogues([
    { nid_1: '16063900', title: 'Weekly Ad July 24th to July 30th', start: '2026-07-23T00:00', finish: '2026-07-30T23:59' },
  ])
  expect(catalogues).toHaveLength(1)
  expect(catalogues[0]).toMatchObject({
    source: 'fairway', externalId: '16063900', merchantSlug: 'fairway',
    validFrom: '2026-07-23T00:00', validTo: '2026-07-30T23:59',
  })
})
