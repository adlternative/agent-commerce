import { describe, expect, it } from 'vitest'
import { lat80Fn6 } from '../src/lib/lat80_6'

describe('lat80_6', () => {
  it('returns 6', () => {
    expect(lat80Fn6()).toBe(6)
  })
})
