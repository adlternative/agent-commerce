import { describe, expect, it } from 'vitest'
import { lat80Fn78 } from '../src/lib/lat80_78'

describe('lat80_78', () => {
  it('returns 78', () => {
    expect(lat80Fn78()).toBe(78)
  })
})
