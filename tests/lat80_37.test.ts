import { describe, expect, it } from 'vitest'
import { lat80Fn37 } from '../src/lib/lat80_37'

describe('lat80_37', () => {
  it('returns 37', () => {
    expect(lat80Fn37()).toBe(37)
  })
})
