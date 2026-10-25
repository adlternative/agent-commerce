import { describe, expect, it } from 'vitest'
import { lat80Fn58 } from '../src/lib/lat80_58'

describe('lat80_58', () => {
  it('returns 58', () => {
    expect(lat80Fn58()).toBe(58)
  })
})
