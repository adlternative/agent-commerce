import { describe, expect, it } from 'vitest'
import {
  validateInitialStock,
  validateThresholdOff,
} from '../../src/merchant/form-validation.js'

describe('validateInitialStock', () => {
  it('accepts zero and positive integers', () => {
    expect(validateInitialStock(0)).toEqual({ ok: true, stock: 0 })
    expect(validateInitialStock(12)).toEqual({ ok: true, stock: 12 })
    expect(validateInitialStock('3')).toEqual({ ok: true, stock: 3 })
  })

  it('rejects missing / non-integer / negative stock', () => {
    expect(validateInitialStock('').ok).toBe(false)
    expect(validateInitialStock(undefined).ok).toBe(false)
    const nonInt = validateInitialStock(1.5)
    expect(nonInt.ok).toBe(false)
    if (!nonInt.ok) expect(nonInt.message).toMatch(/整数/)
    const neg = validateInitialStock(-1)
    expect(neg.ok).toBe(false)
    if (!neg.ok) expect(neg.message).toBe('初始库存不能为负数')
  })
})

describe('validateThresholdOff (满减)', () => {
  it('accepts valid threshold_off fields', () => {
    expect(
      validateThresholdOff({ code: 'FULL100', thresholdCents: 2000, offCents: 100 }),
    ).toEqual({ ok: true, thresholdCents: 2000, offCents: 100 })
  })

  it('rejects negative threshold', () => {
    const r = validateThresholdOff({ code: 'X', thresholdCents: -1, offCents: 0 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toBe('满减门槛不能为负数')
  })

  it('rejects negative discount', () => {
    const r = validateThresholdOff({ code: 'X', thresholdCents: 100, offCents: -5 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toBe('优惠金额不能为负数')
  })

  it('rejects discount exceeding threshold', () => {
    const r = validateThresholdOff({ code: 'X', thresholdCents: 100, offCents: 101 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toBe('优惠金额不能超过满减门槛')
  })

  it('allows discount equal to threshold', () => {
    expect(
      validateThresholdOff({ code: 'X', thresholdCents: 500, offCents: 500 }),
    ).toEqual({ ok: true, thresholdCents: 500, offCents: 500 })
  })
})
