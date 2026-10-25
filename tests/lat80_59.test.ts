import { describe, expect, it } from 'vitest'
import { lat80Fn59 } from '../src/lib/lat80_59'

describe('lat80_59', () => {
  it('returns 59', () => {
    expect(lat80Fn59()).toBe(59)
  })
})
