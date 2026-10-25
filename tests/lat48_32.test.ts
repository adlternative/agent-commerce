import { describe, expect, it } from 'vitest'
import { lat48Fn32 } from '../src/lib/lat48_32'

describe('lat48Fn32', () => {
  it('returns 32', () => {
    expect(lat48Fn32()).toBe(32)
  })
})
