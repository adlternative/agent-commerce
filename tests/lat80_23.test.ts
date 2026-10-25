import { describe, expect, it } from 'vitest'
import { lat80Fn23 } from '../src/lib/lat80_23'

describe('lat80_23', () => {
  it('returns 23', () => {
    expect(lat80Fn23()).toBe(23)
  })
})
