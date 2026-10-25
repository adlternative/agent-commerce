import { describe, expect, it } from 'vitest'
import { lat48Fn23 } from '../src/lib/lat48_23'

describe('lat48Fn23', () => {
  it('returns 23', () => {
    expect(lat48Fn23()).toBe(23)
  })
})
