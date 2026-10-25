import { describe, expect, it } from 'vitest'
import { lat80Fn17 } from '../src/lib/lat80_17'

describe('lat80_17', () => {
  it('returns 17', () => {
    expect(lat80Fn17()).toBe(17)
  })
})
