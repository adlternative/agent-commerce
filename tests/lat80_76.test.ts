import { describe, expect, it } from 'vitest'
import { lat80Fn76 } from '../src/lib/lat80_76'

describe('lat80_76', () => {
  it('returns 76', () => {
    expect(lat80Fn76()).toBe(76)
  })
})
