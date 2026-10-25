import { describe, expect, it } from 'vitest'
import { lat80Fn15 } from '../src/lib/lat80_15'

describe('lat80_15', () => {
  it('returns 15', () => {
    expect(lat80Fn15()).toBe(15)
  })
})
