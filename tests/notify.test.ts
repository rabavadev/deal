import { expect, test } from 'vitest'
import { computeAlerts, dedupeKey } from '@/lib/notify'

const deals = [
  { name: 'Chicken Breast', normalized_name: 'chicken breast', merchant_slug: 'aldi', merchant_name: 'Aldi', price: 1.99, source: 'flipp', external_id: '111' },
  { name: 'Chicken Breast Premium', normalized_name: 'chicken breast premium', merchant_slug: 'c-town', merchant_name: 'C Town', price: 4.99, source: 'flipp', external_id: '222' },
]

test('dedupeKey is stable', () => {
  expect(dedupeKey('milk', { source: 'flipp', external_id: '9' })).toBe('milk:flipp:9')
})

test('computeAlerts matches cheapest, respects max price and dedupe', () => {
  const watches = [
    { device_id: 'd1', term: 'chicken breast', max_price: null },
    { device_id: 'd2', term: 'chicken breast', max_price: 1.5 },   // too expensive → no alert
    { device_id: 'd3', term: 'caviar', max_price: null },           // no match
  ]
  const alerts = computeAlerts(watches, deals as never, new Set())
  expect(alerts).toHaveLength(1)
  expect(alerts[0]).toMatchObject({ deviceId: 'd1', dedupeKey: 'chicken breast:flipp:111' })

  const again = computeAlerts(watches, deals as never, new Set(['d1:chicken breast:flipp:111']))
  expect(again).toHaveLength(0)
})
