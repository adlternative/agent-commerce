import { describe, expect, it } from 'vitest'
import { lat80Fn49 } from '../src/lib/lat80_49'

describe('lat80_49', () => {
  it('returns 49', () => {
    expect(lat80Fn49()).toBe(49)
  })
})
