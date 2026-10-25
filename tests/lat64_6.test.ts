import { describe, expect, it } from 'vitest'
import { lat64Fn6 } from '../src/lib/lat64_6'

describe('lat64_6', () => {
  it('lat64Fn6 returns 6', () => {
    expect(lat64Fn6()).toBe(6)
  })
})
