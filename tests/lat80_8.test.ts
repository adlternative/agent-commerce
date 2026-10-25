import { describe, expect, it } from 'vitest'
import { lat80Fn8 } from '../src/lib/lat80_8'

describe('lat80_8', () => {
  it('returns 8', () => {
    expect(lat80Fn8()).toBe(8)
  })
})
