import { describe, expect, it } from 'vitest'
import { lat24Fn18 } from '../src/lib/lat24_18'

describe('lat24_18', () => {
  it('returns 18', () => {
    expect(lat24Fn18()).toBe(18)
  })
})
