import { describe, expect, it } from 'vitest'
import { lat80Fn36 } from '../src/lib/lat80_36'

describe('lat80_36', () => {
  it('returns 36', () => {
    expect(lat80Fn36()).toBe(36)
  })
})
