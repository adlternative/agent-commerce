import { describe, expect, it } from 'vitest'
import { lat48Fn18 } from '../src/lib/lat48_18'

describe('lat48Fn18', () => {
  it('returns 18', () => {
    expect(lat48Fn18()).toBe(18)
  })
})
