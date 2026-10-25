import { describe, expect, it } from 'vitest'
import { cap96Fn28 } from '../src/lib/cap96_28'

describe('cap96_28', () => {
  it('returns 28', () => {
    expect(cap96Fn28()).toBe(28)
  })
})
