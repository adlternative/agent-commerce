import { describe, expect, it } from 'vitest'
import { cap96Fn63 } from '../src/lib/cap96_63'

describe('cap96_63', () => {
  it('returns 63', () => {
    expect(cap96Fn63()).toBe(63)
  })
})
