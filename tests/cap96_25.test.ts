import { describe, expect, it } from 'vitest'
import { cap96Fn25 } from '../src/lib/cap96_25'

describe('cap96Fn25', () => {
  it('returns 25', () => {
    expect(cap96Fn25()).toBe(25)
  })
})
