import { describe, expect, it } from 'vitest'
import { lat48Fn8 } from '../src/lib/lat48_8'

describe('lat48Fn8', () => {
  it('returns 8', () => {
    expect(lat48Fn8()).toBe(8)
  })
})
