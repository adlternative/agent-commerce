import { describe, expect, it } from 'vitest'
import { cap96Fn1 } from '../src/lib/cap96_1'

describe('cap96_1', () => {
  it('returns 1', () => {
    expect(cap96Fn1()).toBe(1)
  })
})
