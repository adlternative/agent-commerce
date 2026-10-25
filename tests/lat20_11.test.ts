import { describe, expect, it } from 'vitest'
import { lat20Fn11 } from '../src/lib/lat20_11'

describe('lat20_11', () => {
  it('returns 11', () => {
    expect(lat20Fn11()).toBe(11)
  })
})
