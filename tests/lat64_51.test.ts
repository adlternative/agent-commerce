import { describe, expect, it } from 'vitest'
import { lat64Fn51 } from '../src/lib/lat64_51'

describe('lat64Fn51', () => {
  it('returns 51', () => {
    expect(lat64Fn51()).toBe(51)
  })
})
