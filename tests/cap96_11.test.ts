import { describe, expect, it } from 'vitest'
import { cap96Fn11 } from '../src/lib/cap96_11'

describe('cap96_11', () => {
  it('returns 11', () => {
    expect(cap96Fn11()).toBe(11)
  })
})
