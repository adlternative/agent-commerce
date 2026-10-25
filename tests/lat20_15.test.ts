import { describe, expect, it } from 'vitest'
import { lat20Fn15 } from '../src/lib/lat20_15'

describe('lat20_15', () => {
  it('returns 15', () => {
    expect(lat20Fn15()).toBe(15)
  })
})
