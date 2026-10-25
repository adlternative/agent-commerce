import { describe, expect, it } from 'vitest'
import { lat64Fn35 } from '../src/lib/lat64_35'

describe('lat64Fn35', () => {
  it('returns 35', () => {
    expect(lat64Fn35()).toBe(35)
  })
})
