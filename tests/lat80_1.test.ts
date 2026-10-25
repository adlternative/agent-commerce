import { describe, expect, it } from 'vitest'
import { lat80Fn1 } from '../src/lib/lat80_1'

describe('lat80_1', () => {
  it('returns 1', () => {
    expect(lat80Fn1()).toBe(1)
  })
})
