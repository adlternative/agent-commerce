import { describe, expect, it } from 'vitest'
import { cap96Fn24 } from '../src/lib/cap96_24'

describe('cap96_24', () => {
  it('returns 24', () => {
    expect(cap96Fn24()).toBe(24)
  })
})
