import { describe, expect, it } from 'vitest'
import { cap96Fn12 } from '../src/lib/cap96_12'

describe('cap96_12', () => {
  it('returns 12', () => {
    expect(cap96Fn12()).toBe(12)
  })
})
