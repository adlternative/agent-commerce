import { describe, expect, it } from 'vitest'
import { lat80Fn33 } from '../src/lib/lat80_33'

describe('lat80_33', () => {
  it('returns 33', () => {
    expect(lat80Fn33()).toBe(33)
  })
})
