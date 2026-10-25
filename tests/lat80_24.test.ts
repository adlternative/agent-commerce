import { describe, expect, it } from 'vitest'
import { lat80Fn24 } from '../src/lib/lat80_24'

describe('lat80_24', () => {
  it('returns 24', () => {
    expect(lat80Fn24()).toBe(24)
  })
})
