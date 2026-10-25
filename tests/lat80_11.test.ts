import { describe, expect, it } from 'vitest'
import { lat80Fn11 } from '../src/lib/lat80_11'

describe('lat80_11', () => {
  it('returns 11', () => {
    expect(lat80Fn11()).toBe(11)
  })
})
