import { describe, expect, it } from 'vitest'
import { lat80Fn75 } from '../src/lib/lat80_75'

describe('lat80_75', () => {
  it('returns 75', () => {
    expect(lat80Fn75()).toBe(75)
  })
})
