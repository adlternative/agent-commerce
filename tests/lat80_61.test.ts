import { describe, expect, it } from 'vitest'
import { lat80Fn61 } from '../src/lib/lat80_61'

describe('lat80_61', () => {
  it('returns 61', () => {
    expect(lat80Fn61()).toBe(61)
  })
})
