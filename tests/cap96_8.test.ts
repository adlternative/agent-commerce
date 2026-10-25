import { describe, expect, it } from 'vitest'
import { cap96Fn8 } from '../src/lib/cap96_8'

describe('cap96_8', () => {
  it('returns 8', () => {
    expect(cap96Fn8()).toBe(8)
  })
})
