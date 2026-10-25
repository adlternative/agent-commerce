import { describe, expect, it } from 'vitest'
import { lat80Fn52 } from '../src/lib/lat80_52'

describe('lat80_52', () => {
  it('returns 52', () => {
    expect(lat80Fn52()).toBe(52)
  })
})
