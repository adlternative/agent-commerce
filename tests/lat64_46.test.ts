import { describe, expect, it } from 'vitest'
import { lat64Fn46 } from '../src/lib/lat64_46'

describe('lat64_46', () => {
  it('returns 46', () => {
    expect(lat64Fn46()).toBe(46)
  })
})
