import { describe, expect, it } from 'vitest'
import { lat80Fn41 } from '../src/lib/lat80_41'

describe('lat80_41', () => {
  it('returns 41', () => {
    expect(lat80Fn41()).toBe(41)
  })
})
