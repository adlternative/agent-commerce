import { describe, expect, it } from 'vitest'
import { lat80Fn51 } from '../src/lib/lat80_51'

describe('lat80_51', () => {
  it('returns 51', () => {
    expect(lat80Fn51()).toBe(51)
  })
})
