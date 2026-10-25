import { describe, expect, it } from 'vitest'
import { cap96Fn80 } from '../src/lib/cap96_80'

describe('cap96_80', () => {
  it('returns 80', () => {
    expect(cap96Fn80()).toBe(80)
  })
})
