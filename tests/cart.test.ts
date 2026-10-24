import { describe, expect, it } from 'vitest'
import { addToCart, checkStock, removeFromCart, subtotalCents } from '../src/lib/cart'
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
