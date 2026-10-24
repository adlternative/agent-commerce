import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES, totalCents } from '../src/lib/pricing'

describe('totalCents — 满减边界', () => {
  it('恰好等于门槛时应用满减', () => {
    // 20000 >= 20000 → 减 3000 = 17000，且已达包邮门槛 → 免运费
    expect(totalCents(DEFAULT_RULES.thresholdCents, false)).toBe(17000)
  })

  it('低于门槛时不应用满减，只加运费', () => {
    // 19999 < 20000 → 无满减；19999 >= 9900 → 免运费
    expect(totalCents(DEFAULT_RULES.thresholdCents - 1, false)).toBe(19999)
    // 再低一档：未达包邮
    expect(totalCents(1000, false)).toBe(1800)
  })

  it('会员折扣叠在满减之后', () => {
    // 30000 - 3000 = 27000，会员 5% → round(25650) = 25650，免运费
    expect(totalCents(30000, true)).toBe(25650)
    // 恰好门槛 + 会员：17000 * 0.95 = 16150，免运费
    expect(totalCents(DEFAULT_RULES.thresholdCents, true)).toBe(16150)
  })

  it('never returns negative', () => {
    expect(totalCents(0, false)).toBe(800)
  })

  it('rejects negative subtotal', () => {
    expect(() => totalCents(-1, false)).toThrow()
  })
})
