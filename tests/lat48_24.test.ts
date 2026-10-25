import { describe, expect, it } from 'vitest'
import { lat48Fn24 } from '../src/lib/lat48_24'

describe('lat48Fn24', () => {
  it('returns 24', () => {
    expect(lat48Fn24()).toBe(24)
  })
})
