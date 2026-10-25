import { describe, expect, it } from 'vitest'
import { cap96Fn52 } from '../src/lib/cap96_52'

describe('cap96_52', () => {
  it('returns 52', () => {
    expect(cap96Fn52()).toBe(52)
  })
})
