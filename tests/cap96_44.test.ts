import { describe, expect, it } from 'vitest'
import { cap96Fn44 } from '../src/lib/cap96_44'

describe('cap96_44', () => {
  it('returns 44', () => {
    expect(cap96Fn44()).toBe(44)
  })
})
