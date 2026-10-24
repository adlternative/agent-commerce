import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES, totalCents } from '../src/lib/pricing'

describe('totalCents — 满减边界', () => {
  it('exactly at threshold: applies full-reduction discount', () => {
    // 恰好等于门槛 20000 → 减 3000 = 17000，且 >= 包邮门槛 → 免运费
    expect(totalCents(DEFAULT_RULES.thresholdCents, false)).toBe(17000)
  })

  it('below threshold: no full-reduction, still charges shipping', () => {
    // 低于门槛：不减价；1000 < 9900 → +800 运费
    expect(totalCents(1000, false)).toBe(1800)
  })

  it('member stacks after threshold discount', () => {
    // 30000 - 3000 = 27000，会员 5% → 25650，免运费
    expect(totalCents(30000, true)).toBe(25650)
  })

  it('never returns negative', () => {
    expect(totalCents(0, false)).toBe(800)
  })

  it('rejects negative subtotal', () => {
    expect(() => totalCents(-1, false)).toThrow()
  })
})
