import { describe, expect, it } from 'vitest'
import { cap96Fn2 } from '../src/lib/cap96_2'

describe('cap96_2', () => {
  it('returns 2', () => {
    expect(cap96Fn2()).toBe(2)
  })
})
