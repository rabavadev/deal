import { expect, test } from 'vitest'
import { matchBranches } from '@/lib/stores/overpass'

const home = { lat: 40.7823, lng: -73.9525 }
const elements = [
  { type: 'node', id: 1, lat: 40.7794, lon: -73.9497, tags: { name: 'Whole Foods Market', shop: 'supermarket' } },
  { type: 'node', id: 2, lat: 40.784, lon: -73.951, tags: { name: 'Morton Williams', shop: 'supermarket' } },
  { type: 'node', id: 3, lat: 40.7, lon: -74.0, tags: { name: 'Morton Williams', shop: 'supermarket' } },
  { type: 'way', id: 4, center: { lat: 40.779, lon: -73.955 }, tags: { name: 'Fairway Market', shop: 'supermarket' } },
]

test('matches nearest branch per merchant, null when absent', () => {
  const merchants = [
    { slug: 'whole-foods-market', name: 'Whole Foods Market' },
    { slug: 'morton-williams-supermarket', name: 'Morton Williams Supermarket' },
    { slug: 'fairway', name: 'Fairway Market' },
    { slug: 'wegmans', name: "Wegman's" },
  ]
  const rows = matchBranches(merchants, elements as never, home)
  const bySlug = Object.fromEntries(rows.map(r => [r.slug, r]))
  expect(bySlug['whole-foods-market'].distance_miles).toBeGreaterThan(0)
  expect(bySlug['morton-williams-supermarket'].lat).toBe(40.784)  // nearest of the two
  expect(bySlug['fairway'].distance_miles).toBeGreaterThan(0)     // way with center
  expect(bySlug['wegmans'].distance_miles).toBeNull()
})
