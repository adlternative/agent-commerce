import { describe, expect, it } from 'vitest'
import { lat80Fn20 } from '../src/lib/lat80_20'

describe('lat80_20', () => {
  it('returns 20', () => {
    expect(lat80Fn20()).toBe(20)
  })
})
