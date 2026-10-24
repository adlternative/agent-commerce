import { describe, expect, it } from 'vitest'
import {
  applyFixedDiscount,
  applyPercentDiscount,
  applyThresholdDiscount,
} from '../src/lib/set2_discount'

describe('set2_discount', () => {
  describe('applyPercentDiscount', () => {
    it('applies rate inside (0, 1)', () => {
      expect(applyPercentDiscount(10000, 0.1)).toBe(9000)
    })

    it('clamps rate to [0, 1] at the boundaries', () => {
      expect(applyPercentDiscount(10000, 0)).toBe(10000)
      expect(applyPercentDiscount(10000, 1)).toBe(0)
      expect(applyPercentDiscount(10000, -0.5)).toBe(10000)
      expect(applyPercentDiscount(10000, 1.5)).toBe(0)
    })

    it('rejects negative or non-finite subtotal', () => {
      expect(() => applyPercentDiscount(-1, 0.1)).toThrow(RangeError)
      expect(() => applyPercentDiscount(Number.NaN, 0.1)).toThrow(RangeError)
    })
  })

  describe('applyFixedDiscount', () => {
    it('subtracts discount when below subtotal', () => {
      expect(applyFixedDiscount(5000, 1200)).toBe(3800)
    })

    it('clamps discount so result never goes below zero', () => {
      expect(applyFixedDiscount(1000, 1000)).toBe(0)
      expect(applyFixedDiscount(1000, 5000)).toBe(0)
      expect(applyFixedDiscount(0, 100)).toBe(0)
    })

    it('rejects invalid inputs', () => {
      expect(() => applyFixedDiscount(-1, 0)).toThrow(RangeError)
      expect(() => applyFixedDiscount(100, -1)).toThrow(RangeError)
    })
  })

  describe('applyThresholdDiscount', () => {
    it('applies discount when subtotal is exactly at threshold', () => {
      expect(applyThresholdDiscount(20000, 20000, 3000)).toBe(17000)
    })

    it('skips discount when below threshold', () => {
      expect(applyThresholdDiscount(19999, 20000, 3000)).toBe(19999)
    })

    it('never returns negative when discount exceeds subtotal at threshold', () => {
      expect(applyThresholdDiscount(500, 500, 800)).toBe(0)
    })
  })
})
