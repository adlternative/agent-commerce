import { describe, expect, it } from 'vitest'
import { lat48Fn6 } from '../src/lib/lat48_6'

describe('lat48Fn6', () => {
  it('returns 6', () => {
    expect(lat48Fn6()).toBe(6)
  })
})
