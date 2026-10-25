import { describe, expect, it } from 'vitest'
import { lat48Fn30 } from '../src/lib/lat48_30'

describe('lat48Fn30', () => {
  it('returns 30', () => {
    expect(lat48Fn30()).toBe(30)
  })
})
