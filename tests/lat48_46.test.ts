import { describe, expect, it } from 'vitest'
import { lat48Fn46 } from '../src/lib/lat48_46'

describe('lat48Fn46', () => {
  it('returns 46', () => {
    expect(lat48Fn46()).toBe(46)
  })
})
