import { describe, expect, it } from 'vitest'
import { lat80Fn18 } from '../src/lib/lat80_18'

describe('lat80_18', () => {
  it('returns 18', () => {
    expect(lat80Fn18()).toBe(18)
  })
})
