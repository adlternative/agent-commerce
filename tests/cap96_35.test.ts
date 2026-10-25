import { describe, expect, it } from 'vitest'
import { cap96Fn35 } from '../src/lib/cap96_35'

describe('cap96_35', () => {
  it('returns 35', () => {
    expect(cap96Fn35()).toBe(35)
  })
})
