import { describe, expect, it } from 'vitest'
import { lat64Fn13 } from '../src/lib/lat64_13'

describe('lat64_13', () => {
  it('returns 13', () => {
    expect(lat64Fn13()).toBe(13)
  })
})
