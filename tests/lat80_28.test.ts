import { describe, expect, it } from 'vitest'
import { lat80Fn28 } from '../src/lib/lat80_28'

describe('lat80_28', () => {
  it('returns 28', () => {
    expect(lat80Fn28()).toBe(28)
  })
})
