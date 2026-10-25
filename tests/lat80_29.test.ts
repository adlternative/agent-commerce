import { describe, expect, it } from 'vitest'
import { lat80Fn29 } from '../src/lib/lat80_29'

describe('lat80_29', () => {
  it('returns 29', () => {
    expect(lat80Fn29()).toBe(29)
  })
})
