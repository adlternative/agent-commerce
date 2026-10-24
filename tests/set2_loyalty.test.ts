import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOYALTY_RULES,
  applyLoyaltyRedeem,
  earnPoints,
  redeemValueCents,
} from '../src/lib/set2_loyalty'

describe('set2_loyalty', () => {
  describe('earnPoints', () => {
    it('earns floor(spend / centsPerPoint) at exact multiples', () => {
      expect(earnPoints(100)).toBe(1)
      expect(earnPoints(250)).toBe(2)
      expect(earnPoints(999)).toBe(9)
    })

    it('returns 0 at the zero-spend boundary', () => {
      expect(earnPoints(0)).toBe(0)
      expect(earnPoints(99)).toBe(0)
    })

    it('rejects negative or non-finite subtotals', () => {
      expect(() => earnPoints(-1)).toThrow(RangeError)
      expect(() => earnPoints(Number.NaN)).toThrow(RangeError)
    })
  })

  describe('redeemValueCents', () => {
    it('converts points to cents using redeemCentsPerPoint', () => {
      expect(redeemValueCents(50, 100)).toBe(50 * DEFAULT_LOYALTY_RULES.redeemCentsPerPoint)
    })

    it('clamps redeem to available balance at the balance boundary', () => {
      expect(redeemValueCents(80, 50)).toBe(50)
      expect(redeemValueCents(0, 100)).toBe(0)
      expect(redeemValueCents(10, 0)).toBe(0)
    })

    it('rejects invalid inputs', () => {
      expect(() => redeemValueCents(-1, 10)).toThrow(RangeError)
      expect(() => redeemValueCents(10, -1)).toThrow(RangeError)
    })
  })

  describe('applyLoyaltyRedeem', () => {
    it('subtracts redeem value from subtotal', () => {
      expect(applyLoyaltyRedeem(5000, 300, 500)).toBe(4700)
    })

    it('never returns negative when redeem exceeds subtotal', () => {
      expect(applyLoyaltyRedeem(100, 500, 500)).toBe(0)
      expect(applyLoyaltyRedeem(0, 10, 10)).toBe(0)
    })

    it('honors available-points clamp even when request is higher', () => {
      // only 20 points available → 20¢ off a 1000¢ subtotal
      expect(applyLoyaltyRedeem(1000, 999, 20)).toBe(980)
    })
  })
})
