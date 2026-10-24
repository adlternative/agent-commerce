import { describe, expect, it } from 'vitest'
import { totalCents } from '../src/lib/pricing'

describe('totalCents', () => {
  it('adds shipping below free-shipping threshold', () => {
    expect(totalCents(1000, false)).toBe(1800)
  })

  it('applies threshold discount then shipping', () => {
    // 20000 - 3000 = 17000, still below 9900? no: 17000 >= 9900 -> free shipping
    expect(totalCents(20000, false)).toBe(17000)
  })

  it('stacks member rate after threshold discount', () => {
    // 30000 - 3000 = 27000, member 5% -> 25650, free shipping
    expect(totalCents(30000, true)).toBe(25650)
  })

  it('never returns negative', () => {
    expect(totalCents(0, false)).toBe(800)
  })

  it('rejects negative subtotal', () => {
    expect(() => totalCents(-1, false)).toThrow()
  })
})
