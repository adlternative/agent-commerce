import { describe, expect, it } from 'vitest'
import { lat48Fn28 } from '../src/lib/lat48_28'

describe('lat48Fn28', () => {
  it('returns 28', () => {
    expect(lat48Fn28()).toBe(28)
  })
})
