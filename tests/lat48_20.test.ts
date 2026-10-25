import { describe, expect, it } from 'vitest'
import { lat48Fn20 } from '../src/lib/lat48_20'

describe('lat48Fn20', () => {
  it('returns 20', () => {
    expect(lat48Fn20()).toBe(20)
  })
})
