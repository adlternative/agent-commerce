import { describe, expect, it } from 'vitest'
import { lat80Fn9 } from '../src/lib/lat80_9'

describe('lat80_9', () => {
  it('returns 9', () => {
    expect(lat80Fn9()).toBe(9)
  })
})
