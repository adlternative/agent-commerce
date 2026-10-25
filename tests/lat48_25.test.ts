import { describe, expect, it } from 'vitest'
import { lat48Fn25 } from '../src/lib/lat48_25'

describe('lat48Fn25', () => {
  it('returns 25', () => {
    expect(lat48Fn25()).toBe(25)
  })
})
