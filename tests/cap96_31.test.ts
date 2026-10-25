import { describe, expect, it } from 'vitest'
import { cap96Fn31 } from '../src/lib/cap96_31'

describe('cap96_31', () => {
  it('returns 31', () => {
    expect(cap96Fn31()).toBe(31)
  })
})
