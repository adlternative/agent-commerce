import { describe, expect, it } from 'vitest'
import { lat64Fn33 } from '../src/lib/lat64_33'

describe('lat64Fn33', () => {
  it('returns 33', () => {
    expect(lat64Fn33()).toBe(33)
  })
})
