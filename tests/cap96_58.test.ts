import { describe, expect, it } from 'vitest'
import { cap96Fn58 } from '../src/lib/cap96_58'

describe('cap96_58', () => {
  it('cap96Fn58() === 58', () => {
    expect(cap96Fn58()).toBe(58)
  })
})
