import { describe, expect, it } from 'vitest'
import { lat48Fn1 } from '../src/lib/lat48_1'

describe('lat48_1', () => {
  it('lat48Fn1 returns 1', () => {
    expect(lat48Fn1()).toBe(1)
  })
})
