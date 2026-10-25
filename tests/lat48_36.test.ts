import { describe, expect, it } from 'vitest'
import { lat48Fn36 } from '../src/lib/lat48_36'

describe('lat48Fn36', () => {
  it('returns 36', () => {
    expect(lat48Fn36()).toBe(36)
  })
})
