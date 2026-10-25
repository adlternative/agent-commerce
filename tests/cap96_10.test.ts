import { describe, expect, it } from 'vitest'
import { cap96Fn10 } from '../src/lib/cap96_10'

describe('cap96_10', () => {
  it('returns 10', () => {
    expect(cap96Fn10()).toBe(10)
  })
})
