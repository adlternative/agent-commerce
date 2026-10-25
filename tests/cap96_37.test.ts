import { describe, expect, it } from 'vitest'
import { cap96Fn37 } from '../src/lib/cap96_37'

describe('cap96_37', () => {
  it('returns 37', () => {
    expect(cap96Fn37()).toBe(37)
  })
})
