import { describe, expect, it } from 'vitest'
import {
  addToCart,
  applyCoupon,
  checkStock,
  couponDiscountCents,
  getCoupon,
  removeFromCart,
  subtotalCents,
  type Coupon,
} from '../src/lib/cart'
import { catalog } from '../src/lib/catalog'

describe('cart', () => {
  it('adds new line', () => {
    const lines = addToCart([], catalog, 'sku-001')
    expect(lines).toEqual([{ productId: 'sku-001', qty: 1 }])
  })

  it('clamps quantity to stock', () => {
    const lines = addToCart([], catalog, 'sku-001', 99)
    expect(lines[0].qty).toBe(7)
  })

  it('does not mutate input', () => {
    const original: { productId: string; qty: number }[] = []
    addToCart(original, catalog, 'sku-002')
    expect(original).toEqual([])
  })

  it('computes subtotal in cents', () => {
    expect(subtotalCents([{ productId: 'sku-002', qty: 2 }], catalog)).toBe(9980)
  })

  it('removes line', () => {
    expect(removeFromCart([{ productId: 'sku-001', qty: 1 }], 'sku-001')).toEqual([])
  })

  it('reports shortages', () => {
    expect(checkStock([{ productId: 'sku-001', qty: 99 }], catalog)).toEqual([
      { productId: 'sku-001', requested: 99, available: 7 },
    ])
  })

  it('throws on unknown sku', () => {
    expect(() => addToCart([], catalog, 'nope')).toThrow(/unknown product/)
  })
})

describe('cart coupons', () => {
  it('applies fixed-amount coupon when threshold met', () => {
    // sku-002 × 2 = 9980 >= 5000 → SAVE10 = 1000 off
    const result = applyCoupon([{ productId: 'sku-002', qty: 2 }], catalog, 'SAVE10')
    expect(result).toEqual({
      code: 'SAVE10',
      subtotalCents: 9980,
      discountCents: 1000,
      totalCents: 8980,
    })
  })

  it('returns zero discount when below coupon threshold', () => {
    // sku-002 × 1 = 4990 < 5000
    const result = applyCoupon([{ productId: 'sku-002', qty: 1 }], catalog, 'save10')
    expect(result.discountCents).toBe(0)
    expect(result.totalCents).toBe(4990)
  })

  it('applies percent coupon with integer cents', () => {
    // 12900 * 15% = 1935
    const result = applyCoupon([{ productId: 'sku-001', qty: 1 }], catalog, 'OFF15')
    expect(result.discountCents).toBe(1935)
    expect(result.totalCents).toBe(12900 - 1935)
  })

  it('never discounts more than subtotal', () => {
    const coupon: Coupon = { code: 'HUGE', amountOffCents: 999999 }
    expect(couponDiscountCents(100, coupon)).toBe(100)
  })

  it('throws on unknown coupon code', () => {
    expect(() => getCoupon('NOPE')).toThrow(/unknown coupon/)
    expect(() => applyCoupon([], catalog, 'NOPE')).toThrow(/unknown coupon/)
  })

  it('does not mutate cart lines when applying coupon', () => {
    const lines = [{ productId: 'sku-001', qty: 1 }]
    applyCoupon(lines, catalog, 'OFF15')
    expect(lines).toEqual([{ productId: 'sku-001', qty: 1 }])
  })
})
