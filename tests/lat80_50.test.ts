import { describe, expect, it } from 'vitest'
import { lat80Fn50 } from '../src/lib/lat80_50'

describe('lat80_50', () => {
  it('returns 50', () => {
    expect(lat80Fn50()).toBe(50)
  })
})
