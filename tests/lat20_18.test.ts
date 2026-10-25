import { describe, expect, it } from 'vitest'
import { lat20Fn18 } from '../src/lib/lat20_18'

describe('lat20_18', () => {
  it('returns 18', () => {
    expect(lat20Fn18()).toBe(18)
  })
})
