import { describe, expect, it } from 'vitest'
import { cap96Fn65 } from '../src/lib/cap96_65'

describe('cap96_65', () => {
  it('returns 65', () => {
    expect(cap96Fn65()).toBe(65)
  })
})
