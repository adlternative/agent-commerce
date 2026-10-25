import { describe, expect, it } from 'vitest'
import { cap96Fn39 } from '../src/lib/cap96_39'

describe('cap96_39', () => {
  it('returns 39', () => {
    expect(cap96Fn39()).toBe(39)
  })
})
