import { expect, test } from 'vitest'
import { normalizeName, slugify } from '@/lib/parse/normalize'

test('normalizeName strips sizes, punctuation, marketing', () => {
  expect(normalizeName('Organic Blueberries, 18 oz*')).toBe('organic blueberries')
  expect(normalizeName('RAGÚ PASTA SAUCE')).toBe('ragu pasta sauce')
  expect(normalizeName('Outshine Fruit Bars 10.7 to 14.7-fl. oz. pkg., Any Variety')).toBe('outshine fruit bars')
  expect(normalizeName('PEPSI SODA 2-LITER')).toBe('pepsi soda')
})

test('slugify', () => {
  expect(slugify('Morton Williams Supermarket')).toBe('morton-williams-supermarket')
  expect(slugify("BJ's Wholesale Club")).toBe('bjs-wholesale-club')
})
