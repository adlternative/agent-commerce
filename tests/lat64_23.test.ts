import { describe, expect, it } from 'vitest'
import { lat64Fn23 } from '../src/lib/lat64_23'

describe('lat64_23', () => {
  it('returns 23', () => {
    expect(lat64Fn23()).toBe(23)
  })
})
