import { describe, expect, it } from 'vitest'
import { cap96Fn62 } from '../src/lib/cap96_62'

describe('cap96_62', () => {
  it('returns 62', () => {
    expect(cap96Fn62()).toBe(62)
  })
})
