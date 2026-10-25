import { describe, expect, it } from 'vitest'
import { cap96Fn13 } from '../src/lib/cap96_13'

describe('cap96_13', () => {
  it('returns 13', () => {
    expect(cap96Fn13()).toBe(13)
  })
})
