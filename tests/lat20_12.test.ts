import { describe, expect, it } from 'vitest'
import { lat20Fn12 } from '../src/lib/lat20_12'

describe('lat20_12', () => {
  it('returns 12', () => {
    expect(lat20Fn12()).toBe(12)
  })
})
