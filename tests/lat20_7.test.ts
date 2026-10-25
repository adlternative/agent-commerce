import { describe, expect, it } from 'vitest'
import { lat20Fn7 } from '../src/lib/lat20_7'

describe('lat20_7', () => {
  it('returns 7', () => {
    expect(lat20Fn7()).toBe(7)
  })
})
