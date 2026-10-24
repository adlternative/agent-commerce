import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ORDER_RULES,
  summarizeOrder,
  type OrderLine,
} from '../src/lib/order'

const sampleLines: OrderLine[] = [
  { productId: 'sku-001', name: '记事本', qty: 2, unitPriceCents: 2900 },
  { productId: 'sku-002', name: '扩展坞', qty: 1, unitPriceCents: 19900 },
]

describe('summarizeOrder', () => {
  it('computes subtotal, applies threshold discount, and free shipping', () => {
    // subtotal 2900*2 + 19900 = 25700 >= 20000 → discount 3000 → 22700; free shipping
    const summary = summarizeOrder(sampleLines)
    expect(summary.subtotalCents).toBe(25700)
    expect(summary.discountCents).toBe(3000)
    expect(summary.shippingCents).toBe(0)
    expect(summary.totalCents).toBe(22700)
    expect(summary.itemCount).toBe(3)
  })

  it('charges shipping below free-shipping threshold when no discount', () => {
    const lines: OrderLine[] = [
      { productId: 'sku-a', name: '线材', qty: 1, unitPriceCents: 4900 },
    ]
    const summary = summarizeOrder(lines)
    expect(summary.subtotalCents).toBe(4900)
    expect(summary.discountCents).toBe(0)
    expect(summary.shippingCents).toBe(800)
    expect(summary.totalCents).toBe(5700)
  })

  it('applies discount exactly at threshold', () => {
    const lines: OrderLine[] = [
      { productId: 'sku-b', name: '套装', qty: 1, unitPriceCents: 20000 },
    ]
    const summary = summarizeOrder(lines)
    expect(summary.discountCents).toBe(DEFAULT_ORDER_RULES.discountCents)
    // 20000 - 3000 = 17000 >= 9900 → free shipping
    expect(summary.shippingCents).toBe(0)
    expect(summary.totalCents).toBe(17000)
  })

  it('does not apply discount below threshold', () => {
    const lines: OrderLine[] = [
      { productId: 'sku-c', name: '小件', qty: 1, unitPriceCents: 19999 },
    ]
    const summary = summarizeOrder(lines)
    expect(summary.discountCents).toBe(0)
    expect(summary.shippingCents).toBe(0) // 19999 >= 9900 free ship
    expect(summary.totalCents).toBe(19999)
  })

  it('does not mutate input lines', () => {
    const original = sampleLines.map((l) => ({ ...l }))
    summarizeOrder(sampleLines)
    expect(sampleLines).toEqual(original)
  })

  it('returns empty summary for empty cart', () => {
    const summary = summarizeOrder([])
    expect(summary).toEqual({
      lines: [],
      itemCount: 0,
      subtotalCents: 0,
      discountCents: 0,
      shippingCents: 800,
      totalCents: 800,
    })
  })

  it('rejects non-positive qty', () => {
    expect(() =>
      summarizeOrder([{ productId: 'x', name: 'x', qty: 0, unitPriceCents: 100 }]),
    ).toThrow(/qty must be positive/)
  })

  it('rejects negative unit price', () => {
    expect(() =>
      summarizeOrder([{ productId: 'x', name: 'x', qty: 1, unitPriceCents: -1 }]),
    ).toThrow(/unitPriceCents must be >= 0/)
  })
})
