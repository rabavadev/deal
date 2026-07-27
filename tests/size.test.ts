import { describe, expect, test } from 'vitest'
import { parseSize, unitPrice } from '@/lib/parse/size'

describe('parseSize', () => {
  test.each([
    ['Blueberries, 18 oz', { qty: 18, unit: 'oz' }],
    ['10.7 to 14.7-fl. oz. pkg., Any Variety', { qty: 14.7, unit: 'oz' }],   // range → max
    ['PEPSI SODA 2-LITER', { qty: 2, unit: 'l' }],
    ['1-lb. bag', { qty: 1, unit: 'lb' }],
    ['12 ct', { qty: 12, unit: 'ct' }],
    ['6 pk', { qty: 6, unit: 'ct' }],
    ['16 fl oz bottle', { qty: 16, unit: 'oz' }],
    ['1 gallon', { qty: 128, unit: 'oz' }],
    ['32-oz. cont., Any Variety', { qty: 32, unit: 'oz' }],
    ['Half Gallon', { qty: 64, unit: 'oz' }],
    ['2-lb. pkg.', { qty: 2, unit: 'lb' }],
    ['500 ml', { qty: 0.5, unit: 'l' }],
    ['no size here', null],
  ])('parseSize(%j) -> %j', (input, expected) => {
    expect(parseSize(input)).toEqual(expected)
  })
})

describe('unitPrice', () => {
  test('per oz', () => { expect(unitPrice(6.66, { qty: 18, unit: 'oz' })).toBe(0.37) })
  test('per lb passthrough', () => { expect(unitPrice(3.98, { qty: 2, unit: 'lb' })).toBe(1.99) })
  test('per count', () => { expect(unitPrice(6, { qty: 12, unit: 'ct' })).toBe(0.5) })
  test('null safety', () => {
    expect(unitPrice(null, { qty: 18, unit: 'oz' })).toBeNull()
    expect(unitPrice(5, null)).toBeNull()
    expect(unitPrice(5, { qty: 0, unit: 'oz' })).toBeNull()
  })
})
