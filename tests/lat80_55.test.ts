import { describe, expect, it } from 'vitest'
import { lat80Fn55 } from '../src/lib/lat80_55'

describe('lat80_55', () => {
  it('returns 55', () => {
    expect(lat80Fn55()).toBe(55)
  })
})
