import { describe, expect, it } from 'vitest'
import { cap96Fn23 } from '../src/lib/cap96_23'

describe('cap96_23', () => {
  it('returns 23', () => {
    expect(cap96Fn23()).toBe(23)
  })
})
