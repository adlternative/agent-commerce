import { describe, expect, it } from 'vitest'
import { lat80Fn12 } from '../src/lib/lat80_12'

describe('lat80_12', () => {
  it('returns 12', () => {
    expect(lat80Fn12()).toBe(12)
  })
})
