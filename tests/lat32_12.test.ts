import { describe, expect, it } from 'vitest'
import { lat32Fn12 } from '../src/lib/lat32_12'

describe('lat32_12', () => {
  it('returns 12', () => {
    expect(lat32Fn12()).toBe(12)
  })
})
