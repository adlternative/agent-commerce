import { describe, expect, it } from 'vitest'
import { lat80Fn32 } from '../src/lib/lat80_32'

describe('lat80_32', () => {
  it('returns 32', () => {
    expect(lat80Fn32()).toBe(32)
  })
})
