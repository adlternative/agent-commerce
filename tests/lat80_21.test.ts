import { describe, expect, it } from 'vitest'
import { lat80Fn21 } from '../src/lib/lat80_21'

describe('lat80_21', () => {
  it('returns 21', () => {
    expect(lat80Fn21()).toBe(21)
  })
})
