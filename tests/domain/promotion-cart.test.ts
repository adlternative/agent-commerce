import { describe, expect, it } from 'vitest'
import {
  applyPromotionToQuote,
  computeDiscount,
  lineTotal,
  type Promotion,
} from '../../src/domain/promotion.js'
import {
  addCartItem,
  applyPromotionCode,
  createEmptyCart,
  quoteCart,
  removeCartItem,
  updateCartItem,
} from '../../src/domain/cart.js'
import { DomainError } from '../../src/domain/errors.js'

describe('promotion', () => {
  const threshold: Promotion = {
    code: 'SAVE100',
    type: 'threshold_off',
    thresholdCents: 10_000,
    offCents: 1_000,
    active: true,
  }

  it('applies threshold exactly at boundary', () => {
    expect(computeDiscount(10_000, threshold)).toBe(1_000)
    expect(computeDiscount(9_999, threshold)).toBe(0)
  })

  it('applies percent coupon with cap', () => {
    const pct: Promotion = {
      code: 'P10',
      type: 'coupon_percent',
      percentOff: 10,
      maxOffCents: 500,
      active: true,
    }
    expect(computeDiscount(10_000, pct)).toBe(500)
    expect(computeDiscount(3_000, pct)).toBe(300)
  })

  it('quotes lines with discount', () => {
    const quote = applyPromotionToQuote(
      [{ productId: 'p', quantity: 2, unitPriceCents: 6_000, lineTotalCents: 12_000 }],
      threshold,
    )
    expect(quote.subtotalCents).toBe(12_000)
    expect(quote.discountCents).toBe(1_000)
    expect(quote.totalCents).toBe(11_000)
  })
})

describe('cart', () => {
  it('adds / updates / removes immutably and clamps to stock', () => {
    const cart0 = createEmptyCart('c1', 'cust1', new Date('2026-01-01T00:00:00.000Z'))
    const cart1 = addCartItem(cart0, 'p1', 2, 1_500, 5)
    expect(cart0.items).toHaveLength(0)
    expect(cart1.items[0]?.quantity).toBe(2)

    expect(() => addCartItem(cart1, 'p1', 4, 1_500, 5)).toThrow(DomainError)

    const cart2 = updateCartItem(cart1, 'p1', 5, 5)
    expect(cart2.items[0]?.quantity).toBe(5)
    expect(lineTotal(1_500, 5)).toBe(7_500)

    const cart3 = removeCartItem(cart2, 'p1')
    expect(cart3.items).toHaveLength(0)
  })

  it('quotes with applied promotion code', () => {
    let cart = createEmptyCart('c2', 'cust')
    cart = addCartItem(cart, 'p1', 1, 12_000)
    cart = applyPromotionCode(cart, 'SAVE100')
    const promo: Promotion = {
      code: 'SAVE100',
      type: 'threshold_off',
      thresholdCents: 10_000,
      offCents: 1_000,
      active: true,
    }
    const quote = quoteCart(cart, promo)
    expect(quote.totalCents).toBe(11_000)
    expect(quote.promotionCode).toBe('SAVE100')
  })
})
