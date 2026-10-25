import { describe, expect, it } from 'vitest'
import { cap96Fn51 } from '../src/lib/cap96_51'

describe('cap96_51', () => {
  it('returns 51', () => {
    expect(cap96Fn51()).toBe(51)
  })
})
