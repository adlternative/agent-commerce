import { describe, expect, it } from 'vitest'
import { lat80Fn74 } from '../src/lib/lat80_74'

describe('lat80_74', () => {
  it('returns 74', () => {
    expect(lat80Fn74()).toBe(74)
  })
})
