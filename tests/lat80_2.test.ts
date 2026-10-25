import { describe, expect, it } from 'vitest'
import { lat80Fn2 } from '../src/lib/lat80_2'

describe('lat80_2', () => {
  it('returns 2', () => {
    expect(lat80Fn2()).toBe(2)
  })
})
