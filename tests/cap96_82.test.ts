import { describe, expect, it } from 'vitest'
import { cap96Fn82 } from '../src/lib/cap96_82'

describe('cap96_82', () => {
  it('returns 82', () => {
    expect(cap96Fn82()).toBe(82)
  })
})
