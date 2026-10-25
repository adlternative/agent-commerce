import { describe, expect, it } from 'vitest'
import { lat20Fn20 } from '../src/lib/lat20_20'

describe('lat20_20', () => {
  it('lat20Fn20 returns 20', () => {
    expect(lat20Fn20()).toBe(20)
  })
})
