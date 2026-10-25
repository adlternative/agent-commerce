import { describe, expect, it } from 'vitest'
import { cap96Fn33 } from '../src/lib/cap96_33'

describe('cap96_33', () => {
  it('returns 33', () => {
    expect(cap96Fn33()).toBe(33)
  })
})
