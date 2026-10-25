import { describe, expect, it } from 'vitest'
import { lat80Fn65 } from '../src/lib/lat80_65'

describe('lat80_65', () => {
  it('returns 65', () => {
    expect(lat80Fn65()).toBe(65)
  })
})
