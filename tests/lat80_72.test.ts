import { describe, expect, it } from 'vitest'
import { lat80Fn72 } from '../src/lib/lat80_72'

describe('lat80_72', () => {
  it('returns 72', () => {
    expect(lat80Fn72()).toBe(72)
  })
})
