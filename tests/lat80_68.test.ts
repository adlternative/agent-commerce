import { describe, expect, it } from 'vitest'
import { lat80Fn68 } from '../src/lib/lat80_68'

describe('lat80_68', () => {
  it('returns 68', () => {
    expect(lat80Fn68()).toBe(68)
  })
})
