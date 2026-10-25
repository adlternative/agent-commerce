import { describe, expect, it } from 'vitest'
import { cap96Fn76 } from '../src/lib/cap96_76'

describe('cap96_76', () => {
  it('returns 76', () => {
    expect(cap96Fn76()).toBe(76)
  })
})
