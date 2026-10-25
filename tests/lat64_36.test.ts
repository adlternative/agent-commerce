import { describe, expect, it } from 'vitest'
import { lat64Fn36 } from '../src/lib/lat64_36'

describe('lat64_36', () => {
  it('returns 36', () => {
    expect(lat64Fn36()).toBe(36)
  })
})
