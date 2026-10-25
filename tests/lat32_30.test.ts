import { describe, expect, it } from 'vitest'
import { lat32Fn30 } from '../src/lib/lat32_30'

describe('lat32Fn30', () => {
  it('returns 30', () => {
    expect(lat32Fn30()).toBe(30)
  })
})
