import { describe, expect, it } from 'vitest'
import { cap96Fn21 } from '../src/lib/cap96_21'

describe('cap96_21', () => {
  it('returns 21', () => {
    expect(cap96Fn21()).toBe(21)
  })
})
