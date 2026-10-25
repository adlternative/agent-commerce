import { describe, expect, it } from 'vitest'
import { lat20Fn10 } from '../src/lib/lat20_10'

describe('lat20Fn10', () => {
  it('returns 10', () => {
    expect(lat20Fn10()).toBe(10)
  })
})
