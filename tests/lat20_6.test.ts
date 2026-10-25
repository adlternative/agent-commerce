import { describe, expect, it } from 'vitest'
import { lat20Fn6 } from '../src/lib/lat20_6'

describe('lat20_6', () => {
  it('lat20Fn6 returns 6', () => {
    expect(lat20Fn6()).toBe(6)
  })
})
