import { describe, expect, it } from 'vitest'
import { lat80Fn10 } from '../src/lib/lat80_10'

describe('lat80_10', () => {
  it('returns 10', () => {
    expect(lat80Fn10()).toBe(10)
  })
})
