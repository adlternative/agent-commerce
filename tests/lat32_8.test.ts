import { describe, expect, it } from 'vitest'
import { lat32Fn8 } from '../src/lib/lat32_8'

describe('lat32_8', () => {
  it('returns 8', () => {
    expect(lat32Fn8()).toBe(8)
  })
})
