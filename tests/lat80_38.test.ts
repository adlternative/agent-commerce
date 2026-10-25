import { describe, expect, it } from 'vitest'
import { lat80Fn38 } from '../src/lib/lat80_38'

describe('lat80_38', () => {
  it('returns 38', () => {
    expect(lat80Fn38()).toBe(38)
  })
})
