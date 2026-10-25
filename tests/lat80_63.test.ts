import { describe, expect, it } from 'vitest'
import { lat80Fn63 } from '../src/lib/lat80_63'

describe('lat80_63', () => {
  it('returns 63', () => {
    expect(lat80Fn63()).toBe(63)
  })
})
