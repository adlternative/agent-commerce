import { describe, expect, it } from 'vitest'
import { cap96Fn6 } from '../src/lib/cap96_6'

describe('cap96_6', () => {
  it('returns 6', () => {
    expect(cap96Fn6()).toBe(6)
  })
})
