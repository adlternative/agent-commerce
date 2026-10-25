import { describe, expect, it } from 'vitest'
import { lat64Fn58 } from '../src/lib/lat64_58'

describe('lat64Fn58', () => {
  it('returns 58', () => {
    expect(lat64Fn58()).toBe(58)
  })
})
