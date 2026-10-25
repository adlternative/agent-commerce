import { describe, expect, it } from 'vitest'
import { lat80Fn45 } from '../src/lib/lat80_45'

describe('lat80_45', () => {
  it('returns 45', () => {
    expect(lat80Fn45()).toBe(45)
  })
})
