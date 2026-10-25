import { describe, expect, it } from 'vitest'
import { cap96Fn27 } from '../src/lib/cap96_27'

describe('cap96_27', () => {
  it('returns 27', () => {
    expect(cap96Fn27()).toBe(27)
  })
})
