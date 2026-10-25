import { describe, expect, it } from 'vitest'
import { cap96Fn22 } from '../src/lib/cap96_22'

describe('cap96_22', () => {
  it('returns 22', () => {
    expect(cap96Fn22()).toBe(22)
  })
})
