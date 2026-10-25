import { describe, expect, it } from 'vitest'
import { cap96Fn50 } from '../src/lib/cap96_50'

describe('cap96_50', () => {
  it('returns 50', () => {
    expect(cap96Fn50()).toBe(50)
  })
})
