import { describe, expect, it } from 'vitest'
import { cap96Fn91 } from '../src/lib/cap96_91'

describe('cap96_91', () => {
  it('returns 91', () => {
    expect(cap96Fn91()).toBe(91)
  })
})
