import { describe, expect, it } from 'vitest'
import { lat80Fn46 } from '../src/lib/lat80_46'

describe('lat80_46', () => {
  it('returns 46', () => {
    expect(lat80Fn46()).toBe(46)
  })
})
