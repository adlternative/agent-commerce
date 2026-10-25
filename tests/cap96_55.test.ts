import { describe, expect, it } from 'vitest'
import { cap96Fn55 } from '../src/lib/cap96_55'

describe('cap96_55', () => {
  it('returns 55', () => {
    expect(cap96Fn55()).toBe(55)
  })
})
