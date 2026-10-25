import { describe, expect, it } from 'vitest'
import { lat48Fn12 } from '../src/lib/lat48_12'

describe('lat48Fn12', () => {
  it('returns 12', () => {
    expect(lat48Fn12()).toBe(12)
  })
})
