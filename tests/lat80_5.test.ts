import { describe, expect, it } from 'vitest'
import { lat80Fn5 } from '../src/lib/lat80_5'

describe('lat80_5', () => {
  it('returns 5', () => {
    expect(lat80Fn5()).toBe(5)
  })
})
