import { describe, expect, it } from 'vitest'
import { lat32Fn3 } from '../src/lib/lat32_3'

describe('lat32Fn3', () => {
  it('returns 3', () => {
    expect(lat32Fn3()).toBe(3)
  })
})
