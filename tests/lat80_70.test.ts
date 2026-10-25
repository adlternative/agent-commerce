import { describe, expect, it } from 'vitest'
import { lat80Fn70 } from '../src/lib/lat80_70'

describe('lat80_70', () => {
  it('returns 70', () => {
    expect(lat80Fn70()).toBe(70)
  })
})
