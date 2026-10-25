import { describe, expect, it } from 'vitest'
import { cap96Fn20 } from '../src/lib/cap96_20'

describe('cap96Fn20', () => {
  it('returns 20', () => {
    expect(cap96Fn20()).toBe(20)
  })
})
