import { describe, expect, it } from 'vitest'
import { lat48Fn13 } from '../src/lib/lat48_13'

describe('lat48Fn13', () => {
  it('returns 13', () => {
    expect(lat48Fn13()).toBe(13)
  })
})
