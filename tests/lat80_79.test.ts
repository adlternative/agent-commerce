import { describe, expect, it } from 'vitest'
import { lat80Fn79 } from '../src/lib/lat80_79'

describe('lat80_79', () => {
  it('returns 79', () => {
    expect(lat80Fn79()).toBe(79)
  })
})
