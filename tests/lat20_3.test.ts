import { describe, expect, it } from 'vitest'
import { lat20Fn3 } from '../src/lib/lat20_3'

describe('lat20_3', () => {
  it('returns 3', () => {
    expect(lat20Fn3()).toBe(3)
  })
})
