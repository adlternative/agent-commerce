import { describe, expect, it } from 'vitest'
import { lat80Fn60 } from '../src/lib/lat80_60'

describe('lat80_60', () => {
  it('returns 60', () => {
    expect(lat80Fn60()).toBe(60)
  })
})
