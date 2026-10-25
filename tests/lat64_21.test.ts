import { describe, expect, it } from 'vitest'
import { lat64Fn21 } from '../src/lib/lat64_21'

describe('lat64Fn21', () => {
  it('returns 21', () => {
    expect(lat64Fn21()).toBe(21)
  })
})
