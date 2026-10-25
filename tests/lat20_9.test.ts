import { describe, expect, it } from 'vitest'
import { lat20Fn9 } from '../src/lib/lat20_9'

describe('lat20_9', () => {
  it('returns 9', () => {
    expect(lat20Fn9()).toBe(9)
  })
})
