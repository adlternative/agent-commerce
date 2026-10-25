import { describe, expect, it } from 'vitest'
import { lat64Fn50 } from '../src/lib/lat64_50'

describe('lat64_50', () => {
  it('returns 50', () => {
    expect(lat64Fn50()).toBe(50)
  })
})
