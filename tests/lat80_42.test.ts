import { describe, expect, it } from 'vitest'
import { lat80Fn42 } from '../src/lib/lat80_42'

describe('lat80_42', () => {
  it('returns 42', () => {
    expect(lat80Fn42()).toBe(42)
  })
})
