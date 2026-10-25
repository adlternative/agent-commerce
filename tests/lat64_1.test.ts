import { describe, expect, it } from 'vitest'
import { lat64Fn1 } from '../src/lib/lat64_1'

describe('lat64_1', () => {
  it('lat64Fn1 returns 1', () => {
    expect(lat64Fn1()).toBe(1)
  })
})
