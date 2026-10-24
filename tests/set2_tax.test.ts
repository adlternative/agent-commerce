import { describe, expect, it } from 'vitest'
import {
  clampRateBps,
  taxCents,
  taxFromInclusiveCents,
  totalWithTaxCents,
} from '../src/lib/set2_tax'

describe('set2_tax', () => {
  describe('taxCents', () => {
    it('computes tax at a standard rate (10% = 1000 bps)', () => {
      expect(taxCents(10_000, 1000)).toBe(1000)
    })

    it('returns 0 at zero/negative amount or rate boundaries', () => {
      expect(taxCents(0, 1000)).toBe(0)
      expect(taxCents(-50, 1000)).toBe(0)
      expect(taxCents(10_000, 0)).toBe(0)
      expect(taxCents(10_000, -100)).toBe(0)
      expect(taxCents(Number.NaN, 1000)).toBe(0)
    })

    it('rounds fractional cents half-up', () => {
      // 99 * 1000 / 10000 = 9.9 → 10
      expect(taxCents(99, 1000)).toBe(10)
    })
  })

  describe('totalWithTaxCents', () => {
    it('adds tax to subtotal', () => {
      expect(totalWithTaxCents(10_000, 1000)).toBe(11_000)
    })

    it('equals subtotal when rate is zero', () => {
      expect(totalWithTaxCents(2500, 0)).toBe(2500)
    })
  })

  describe('taxFromInclusiveCents', () => {
    it('extracts tax from an inclusive total at the rate boundary', () => {
      // 11000 inclusive at 10% → net 10000, tax 1000
      expect(taxFromInclusiveCents(11_000, 1000)).toBe(1000)
    })

    it('returns 0 for zero inclusive or zero rate', () => {
      expect(taxFromInclusiveCents(0, 1000)).toBe(0)
      expect(taxFromInclusiveCents(11_000, 0)).toBe(0)
    })
  })

  describe('clampRateBps', () => {
    it('clamps to [0, maxBps] inclusive', () => {
      expect(clampRateBps(500, 1000)).toBe(500)
      expect(clampRateBps(-1, 1000)).toBe(0)
      expect(clampRateBps(1500, 1000)).toBe(1000)
    })

    it('rejects non-finite inputs', () => {
      expect(() => clampRateBps(Number.NaN, 1000)).toThrow(RangeError)
      expect(() => clampRateBps(100, Number.POSITIVE_INFINITY)).toThrow(RangeError)
    })
  })
})
