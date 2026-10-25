import { describe, expect, it } from 'vitest'
import { lat80Fn80 } from '../src/lib/lat80_80'

describe('lat80_80', () => {
  it('returns 80', () => {
    expect(lat80Fn80()).toBe(80)
  })
})
