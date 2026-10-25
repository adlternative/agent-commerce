import { describe, expect, it } from 'vitest'
import { lat80Fn57 } from '../src/lib/lat80_57'

describe('lat80_57', () => {
  it('returns 57', () => {
    expect(lat80Fn57()).toBe(57)
  })
})
