import { describe, expect, it } from 'vitest'
import { cap96Fn32 } from '../src/lib/cap96_32'

describe('cap96_32', () => {
  it('returns 32', () => {
    expect(cap96Fn32()).toBe(32)
  })
})
