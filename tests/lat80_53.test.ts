import { describe, expect, it } from 'vitest'
import { lat80Fn53 } from '../src/lib/lat80_53'

describe('lat80_53', () => {
  it('returns 53', () => {
    expect(lat80Fn53()).toBe(53)
  })
})
