import { describe, expect, it } from 'vitest'
import { cap96Fn42 } from '../src/lib/cap96_42'

describe('cap96_42', () => {
  it('returns 42', () => {
    expect(cap96Fn42()).toBe(42)
  })
})
