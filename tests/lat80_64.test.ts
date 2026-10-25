import { describe, expect, it } from 'vitest'
import { lat80Fn64 } from '../src/lib/lat80_64'

describe('lat80_64', () => {
  it('returns 64', () => {
    expect(lat80Fn64()).toBe(64)
  })
})
