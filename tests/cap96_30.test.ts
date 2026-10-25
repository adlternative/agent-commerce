import { describe, expect, it } from 'vitest'
import { cap96Fn30 } from '../src/lib/cap96_30'

describe('cap96_30', () => {
  it('returns 30', () => {
    expect(cap96Fn30()).toBe(30)
  })
})
