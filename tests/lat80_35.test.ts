import { describe, expect, it } from 'vitest'
import { lat80Fn35 } from '../src/lib/lat80_35'

describe('lat80_35', () => {
  it('returns 35', () => {
    expect(lat80Fn35()).toBe(35)
  })
})
