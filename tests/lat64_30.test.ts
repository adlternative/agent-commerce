import { describe, expect, it } from 'vitest'
import { lat64Fn30 } from '../src/lib/lat64_30'

describe('lat64Fn30', () => {
  it('returns 30', () => {
    expect(lat64Fn30()).toBe(30)
  })
})
