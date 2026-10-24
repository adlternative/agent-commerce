import { describe, expect, it } from 'vitest'
import {
  approveRefund,
  fullRefundCents,
  remainingRefundableCents,
} from '../src/lib/set2_refund'

describe('set2_refund', () => {
  describe('remainingRefundableCents', () => {
    it('returns paid − alreadyRefunded at the exact boundary', () => {
      expect(remainingRefundableCents(10000, 0)).toBe(10000)
      expect(remainingRefundableCents(10000, 10000)).toBe(0)
      expect(remainingRefundableCents(10000, 4000)).toBe(6000)
    })

    it('never goes negative when alreadyRefunded exceeds paid', () => {
      expect(remainingRefundableCents(5000, 8000)).toBe(0)
    })

    it('rejects non-finite and negative inputs', () => {
      expect(() => remainingRefundableCents(Number.NaN, 0)).toThrow(RangeError)
      expect(() => remainingRefundableCents(-1, 0)).toThrow(RangeError)
      expect(() => remainingRefundableCents(100, -1)).toThrow(RangeError)
    })
  })

  describe('approveRefund', () => {
    it('approves partial refunds under the remaining balance', () => {
      const result = approveRefund({
        paidCents: 10000,
        alreadyRefundedCents: 2000,
        requestCents: 3000,
      })
      expect(result).toEqual({
        refundedCents: 3000,
        remainingCents: 5000,
        capped: false,
      })
    })

    it('caps at remaining when request exceeds refundable (upper boundary)', () => {
      const result = approveRefund({
        paidCents: 10000,
        alreadyRefundedCents: 7000,
        requestCents: 5000,
      })
      expect(result).toEqual({
        refundedCents: 3000,
        remainingCents: 0,
        capped: true,
      })
    })

    it('treats zero request as a no-op (lower boundary)', () => {
      const result = approveRefund({
        paidCents: 10000,
        alreadyRefundedCents: 1000,
        requestCents: 0,
      })
      expect(result).toEqual({
        refundedCents: 0,
        remainingCents: 9000,
        capped: false,
      })
    })

    it('does not mutate the request object', () => {
      const request = {
        paidCents: 5000,
        alreadyRefundedCents: 0,
        requestCents: 1000,
      }
      const snapshot = { ...request }
      approveRefund(request)
      expect(request).toEqual(snapshot)
    })
  })

  describe('fullRefundCents', () => {
    it('refunds the full remaining balance including already-refunded boundary', () => {
      expect(fullRefundCents(12000)).toBe(12000)
      expect(fullRefundCents(12000, 4000)).toBe(8000)
      expect(fullRefundCents(12000, 12000)).toBe(0)
    })
  })
})
