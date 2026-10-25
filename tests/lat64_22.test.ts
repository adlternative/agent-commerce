import { describe, expect, it } from 'vitest'
import { lat64Fn22 } from '../src/lib/lat64_22'

describe('lat64Fn22', () => {
  it('returns 22', () => {
    expect(lat64Fn22()).toBe(22)
  })
})
