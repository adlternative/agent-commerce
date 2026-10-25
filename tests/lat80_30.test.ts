import { describe, expect, it } from 'vitest'
import { lat80Fn30 } from '../src/lib/lat80_30'

describe('lat80_30', () => {
  it('returns 30', () => {
    expect(lat80Fn30()).toBe(30)
  })
})
