import { describe, expect, it } from 'vitest'
import { lat80Fn44 } from '../src/lib/lat80_44'

describe('lat80_44', () => {
  it('returns 44', () => {
    expect(lat80Fn44()).toBe(44)
  })
})
