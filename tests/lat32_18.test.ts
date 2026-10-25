import { describe, expect, it } from 'vitest'
import { lat32Fn18 } from '../src/lib/lat32_18'

describe('lat32Fn18', () => {
  it('returns 18', () => {
    expect(lat32Fn18()).toBe(18)
  })
})
