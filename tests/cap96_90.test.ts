import { describe, expect, it } from 'vitest'
import { cap96Fn90 } from '../src/lib/cap96_90'

describe('cap96_90', () => {
  it('returns 90', () => {
    expect(cap96Fn90()).toBe(90)
  })
})
