import { describe, expect, it } from 'vitest'
import { cap96Fn15 } from '../src/lib/cap96_15'

describe('cap96_15', () => {
  it('returns 15', () => {
    expect(cap96Fn15()).toBe(15)
  })
})
