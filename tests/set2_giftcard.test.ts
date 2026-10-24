import { describe, expect, it } from 'vitest'
import {
  isRedeemable,
  payableAfterGiftCardCents,
  redeemAmountCents,
  remainingBalanceCents,
} from '../src/lib/set2_giftcard'

describe('set2_giftcard', () => {
  describe('redeemAmountCents', () => {
    it('applies the full balance when it is below the order total', () => {
      expect(redeemAmountCents(1000, 400)).toBe(400)
    })

    it('caps at the order total when balance is larger (exact boundary)', () => {
      expect(redeemAmountCents(500, 500)).toBe(500)
      expect(redeemAmountCents(500, 800)).toBe(500)
    })

    it('returns 0 for non-positive or non-finite inputs', () => {
      expect(redeemAmountCents(0, 100)).toBe(0)
      expect(redeemAmountCents(100, 0)).toBe(0)
      expect(redeemAmountCents(-50, 100)).toBe(0)
      expect(redeemAmountCents(100, -10)).toBe(0)
      expect(redeemAmountCents(Number.NaN, 100)).toBe(0)
      expect(redeemAmountCents(100, Number.POSITIVE_INFINITY)).toBe(0)
    })

    it('floors fractional cents', () => {
      expect(redeemAmountCents(99.9, 50.8)).toBe(50)
    })
  })

  describe('remainingBalanceCents', () => {
    it('subtracts redeemed amount and never goes negative', () => {
      expect(remainingBalanceCents(1000, 300)).toBe(700)
      expect(remainingBalanceCents(200, 200)).toBe(0)
      expect(remainingBalanceCents(100, 150)).toBe(0)
    })

    it('treats invalid redeem/balance as zero contribution', () => {
      expect(remainingBalanceCents(100, Number.NaN)).toBe(100)
      expect(remainingBalanceCents(-5, 10)).toBe(0)
    })
  })

  describe('payableAfterGiftCardCents', () => {
    it('returns residual when balance is below total', () => {
      expect(payableAfterGiftCardCents(1000, 250)).toBe(750)
    })

    it('returns 0 when balance covers or exceeds the total', () => {
      expect(payableAfterGiftCardCents(400, 400)).toBe(0)
      expect(payableAfterGiftCardCents(400, 900)).toBe(0)
    })
  })

  describe('isRedeemable', () => {
    it('is true only for positive finite balance', () => {
      expect(isRedeemable(1)).toBe(true)
      expect(isRedeemable(0)).toBe(false)
      expect(isRedeemable(-1)).toBe(false)
      expect(isRedeemable(Number.NaN)).toBe(false)
    })
  })
})
