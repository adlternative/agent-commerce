import { describe, expect, it } from 'vitest'
import { lat80Fn13 } from '../src/lib/lat80_13'

describe('lat80_13', () => {
  it('returns 13', () => {
    expect(lat80Fn13()).toBe(13)
  })
})
