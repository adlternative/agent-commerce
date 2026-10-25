import { describe, expect, it } from 'vitest'
import { lat64Fn62 } from '../src/lib/lat64_62'

describe('lat64_62', () => {
  it('lat64Fn62 returns 62', () => {
    expect(lat64Fn62()).toBe(62)
  })
})
