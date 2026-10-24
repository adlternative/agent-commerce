import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SHIPPING_RULES,
  qualifiesForFreeShipping,
  shippingCents,
  totalWithShipping,
} from '../src/lib/set2_shipping'

describe('set2_shipping', () => {
  describe('shippingCents', () => {
    it('charges flat shipping below free-shipping threshold', () => {
      expect(shippingCents(9899)).toBe(DEFAULT_SHIPPING_RULES.shippingCents)
      expect(shippingCents(0)).toBe(800)
    })

    it('is free exactly at the free-shipping threshold (inclusive boundary)', () => {
      expect(shippingCents(9900)).toBe(0)
      expect(shippingCents(9901)).toBe(0)
    })
  })

  describe('qualifiesForFreeShipping', () => {
    it('is false below threshold and true at/above', () => {
      expect(qualifiesForFreeShipping(9899)).toBe(false)
      expect(qualifiesForFreeShipping(9900)).toBe(true)
      expect(qualifiesForFreeShipping(15000)).toBe(true)
    })
  })

  describe('totalWithShipping', () => {
    it('adds shipping below threshold and not above', () => {
      expect(totalWithShipping(5000)).toBe(5800)
      expect(totalWithShipping(9900)).toBe(9900)
    })

    it('rejects negative or non-finite subtotals', () => {
      expect(() => shippingCents(-1)).toThrow(RangeError)
      expect(() => qualifiesForFreeShipping(Number.NaN)).toThrow(RangeError)
      expect(() => totalWithShipping(Number.POSITIVE_INFINITY)).toThrow(RangeError)
    })
  })
})
