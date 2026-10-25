import { describe, expect, it } from 'vitest'
import { lat32Fn24 } from '../src/lib/lat32_24'

describe('lat32_24', () => {
  it('returns 24', () => {
    expect(lat32Fn24()).toBe(24)
  })
})
