import { describe, expect, it } from 'vitest'
import { cap96Fn61 } from '../src/lib/cap96_61'

describe('cap96_61', () => {
  it('returns 61', () => {
    expect(cap96Fn61()).toBe(61)
  })
})
