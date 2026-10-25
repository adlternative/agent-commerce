import { describe, expect, it } from 'vitest'
import { lat80Fn25 } from '../src/lib/lat80_25'

describe('lat80_25', () => {
  it('returns 25', () => {
    expect(lat80Fn25()).toBe(25)
  })
})
