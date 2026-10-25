import { describe, expect, it } from 'vitest'
import { cap96Fn72 } from '../src/lib/cap96_72'

describe('cap96_72', () => {
  it('returns 72', () => {
    expect(cap96Fn72()).toBe(72)
  })
})
