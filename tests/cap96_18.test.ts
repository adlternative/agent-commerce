import { describe, expect, it } from 'vitest'
import { cap96Fn18 } from '../src/lib/cap96_18'

describe('cap96Fn18', () => {
  it('returns 18', () => {
    expect(cap96Fn18()).toBe(18)
  })
})
