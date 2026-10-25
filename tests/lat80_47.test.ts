import { describe, expect, it } from 'vitest'
import { lat80Fn47 } from '../src/lib/lat80_47'

describe('lat80_47', () => {
  it('returns 47', () => {
    expect(lat80Fn47()).toBe(47)
  })
})
