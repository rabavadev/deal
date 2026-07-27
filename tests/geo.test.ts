import { expect, test } from 'vitest'
import { haversineMiles } from '@/lib/geo'

test('haversine: E 90th St to Union Square ~ 4.3 mi', () => {
  const d = haversineMiles({ lat: 40.7823, lng: -73.9525 }, { lat: 40.7359, lng: -73.9906 })
  expect(d).toBeGreaterThan(3.7); expect(d).toBeLessThan(4.9)
})
