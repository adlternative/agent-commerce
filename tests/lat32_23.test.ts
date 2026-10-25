import { describe, expect, it } from 'vitest'
import { lat32Fn23 } from '../src/lib/lat32_23'

describe('lat32Fn23', () => {
  it('returns 23', () => {
    expect(lat32Fn23()).toBe(23)
  })
})
