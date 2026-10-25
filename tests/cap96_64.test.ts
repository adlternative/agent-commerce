import { describe, expect, it } from 'vitest'
import { cap96Fn64 } from '../src/lib/cap96_64'

describe('cap96_64', () => {
  it('returns 64', () => {
    expect(cap96Fn64()).toBe(64)
  })
})
