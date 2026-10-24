import { describe, expect, it } from 'vitest'
import { clamp, clampQuantity, safeDivide } from '../src/lib/probe6_a'

describe('probe6_a', () => {
  describe('clamp', () => {
    it('returns value when inside range', () => {
      expect(clamp(5, 0, 10)).toBe(5)
    })

    it('clamps to lower and upper bounds', () => {
      expect(clamp(-1, 0, 10)).toBe(0)
      expect(clamp(11, 0, 10)).toBe(10)
    })

    it('handles inverted min/max by normalizing the range', () => {
      expect(clamp(5, 10, 0)).toBe(5)
      expect(clamp(-1, 10, 0)).toBe(0)
    })

    it('rejects non-finite inputs', () => {
      expect(() => clamp(Number.NaN, 0, 1)).toThrow(RangeError)
      expect(() => clamp(1, Number.POSITIVE_INFINITY, 2)).toThrow(RangeError)
    })
  })

  describe('clampQuantity', () => {
    it('caps qty by stock at the stock boundary', () => {
      expect(clampQuantity(5, 5)).toBe(5)
      expect(clampQuantity(6, 5)).toBe(5)
    })

    it('returns 0 for non-positive qty or empty stock', () => {
      expect(clampQuantity(0, 10)).toBe(0)
      expect(clampQuantity(-3, 10)).toBe(0)
      expect(clampQuantity(3, 0)).toBe(0)
      expect(clampQuantity(3, -1)).toBe(0)
    })

    it('floors fractional qty and stock', () => {
      expect(clampQuantity(2.9, 10)).toBe(2)
      expect(clampQuantity(5, 3.7)).toBe(3)
    })
  })

  describe('safeDivide', () => {
    it('divides when denominator is non-zero', () => {
      expect(safeDivide(10, 2)).toBe(5)
    })

    it('returns 0 on zero denominator and non-finite inputs', () => {
      expect(safeDivide(10, 0)).toBe(0)
      expect(safeDivide(Number.NaN, 2)).toBe(0)
      expect(safeDivide(1, Number.POSITIVE_INFINITY)).toBe(0)
    })
  })
})
