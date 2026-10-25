import { describe, expect, it } from 'vitest'
import { lat80Fn39 } from '../src/lib/lat80_39'

describe('lat80_39', () => {
  it('returns 39', () => {
    expect(lat80Fn39()).toBe(39)
  })
})
