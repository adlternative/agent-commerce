import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES, totalCents } from '../src/lib/pricing'

describe('totalCents — 满减边界', () => {
  it('恰好等于门槛：触发满减，免运费', () => {
    // 20000 - 3000 = 17000，且 17000 >= 9900 → 包邮
    expect(totalCents(DEFAULT_RULES.thresholdCents, false)).toBe(17000)
  })

  it('低于门槛：不触发满减', () => {
    // 19999 < 20000，无满减；19999 >= 9900 → 包邮
    expect(totalCents(DEFAULT_RULES.thresholdCents - 1, false)).toBe(19999)
  })

  it('会员叠加：先满减再乘会员折扣', () => {
    // 30000 - 3000 = 27000，会员 5% → 25650，包邮
    expect(totalCents(30000, true)).toBe(25650)
  })
})

describe('totalCents — 其它约束', () => {
  it('未达包邮门槛加运费', () => {
    expect(totalCents(1000, false)).toBe(1800)
  })

  it('应付总额不为负', () => {
    expect(totalCents(0, false)).toBe(800)
  })

  it('拒绝负小计', () => {
    expect(() => totalCents(-1, false)).toThrow()
  })
})
