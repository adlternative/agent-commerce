import { describe, expect, it } from 'vitest'
import { lat80Fn34 } from '../src/lib/lat80_34'

describe('lat80_34', () => {
  it('returns 34', () => {
    expect(lat80Fn34()).toBe(34)
  })
})
