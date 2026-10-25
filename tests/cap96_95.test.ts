import { describe, expect, it } from 'vitest'
import { cap96Fn95 } from '../src/lib/cap96_95'

describe('cap96_95', () => {
  it('returns 95', () => {
    expect(cap96Fn95()).toBe(95)
  })
})
