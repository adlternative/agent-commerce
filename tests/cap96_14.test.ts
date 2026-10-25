import { describe, expect, it } from 'vitest'
import { cap96Fn14 } from '../src/lib/cap96_14'

describe('cap96_14', () => {
  it('returns 14', () => {
    expect(cap96Fn14()).toBe(14)
  })
})
