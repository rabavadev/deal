import { describe, expect, test } from 'vitest'
import { parsePrice, parseUnit } from '@/lib/parse/price'

describe('parsePrice', () => {
  test.each([
    [3.99, 3.99], ['3.99', 3.99], ['$3.99', 3.99], ['3.0', 3],
    ['2/$5', 2.5], ['2 for $5', 2.5], ['4 for $5', 1.25], ['2/$7.00', 3.5],
    ['$3.99/lb', 3.99], ['$5.99 ea', 5.99], ['$5.99 eawith Prime', 5.99],
    ['$6.66 ea $7.99', 6.66],           // first price wins
    ['$5.39 to $7.39/lb', null],        // ranges have no single price
    ['20% off', null], ['Buy 1, Get 1 50% off', null],
    ['', null], [null, null], [undefined, null], ['FREE', null],
  ])('parsePrice(%j) -> %j', (input, expected) => {
    expect(parsePrice(input as never)).toBe(expected)
  })
})

describe('parseUnit', () => {
  test.each([
    ['$3.99/lb', 'lb'], ['per lb', 'lb'], ['$5.99 ea', 'ea'], ['each', 'ea'],
    ['$3.99', null], [null, null],
  ])('parseUnit(%j) -> %j', (input, expected) => {
    expect(parseUnit(input as never)).toBe(expected)
  })
})
