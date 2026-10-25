import { describe, expect, it } from 'vitest'
import { lat80Fn22 } from '../src/lib/lat80_22'

describe('lat80_22', () => {
  it('returns 22', () => {
    expect(lat80Fn22()).toBe(22)
  })
})
