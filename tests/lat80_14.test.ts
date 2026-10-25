import { describe, expect, it } from 'vitest'
import { lat80Fn14 } from '../src/lib/lat80_14'

describe('lat80_14', () => {
  it('returns 14', () => {
    expect(lat80Fn14()).toBe(14)
  })
})
