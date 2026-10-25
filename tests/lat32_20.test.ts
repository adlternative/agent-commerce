import { describe, expect, it } from 'vitest'
import { lat32Fn20 } from '../src/lib/lat32_20'

describe('lat32_20', () => {
  it('returns 20', () => {
    expect(lat32Fn20()).toBe(20)
  })
})
