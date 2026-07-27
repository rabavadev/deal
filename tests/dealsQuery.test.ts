import { expect, test } from 'vitest'
import { parseDealsParams } from '@/lib/api/dealsQuery'

test('defaults', () => {
  expect(parseDealsParams(new URLSearchParams())).toEqual({
    q: null, stores: null, category: null, status: 'active', sort: 'discount', limit: 200,
  })
})

test('parses and clamps', () => {
  const p = parseDealsParams(new URLSearchParams('q=chicken&stores=aldi,fairway&category=meat&status=upcoming&sort=price&limit=9999'))
  expect(p).toEqual({ q: 'chicken', stores: ['aldi', 'fairway'], category: 'meat', status: 'upcoming', sort: 'price', limit: 500 })
})
