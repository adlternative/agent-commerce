import { describe, expect, it } from 'vitest'
import { lat80Fn62 } from '../src/lib/lat80_62'

describe('lat80_62', () => {
  it('returns 62', () => {
    expect(lat80Fn62()).toBe(62)
  })
})
