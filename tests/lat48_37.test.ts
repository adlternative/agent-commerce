import { describe, expect, it } from 'vitest'
import { lat48Fn37 } from '../src/lib/lat48_37'

describe('lat48Fn37', () => {
  it('returns 37', () => {
    expect(lat48Fn37()).toBe(37)
  })
})
