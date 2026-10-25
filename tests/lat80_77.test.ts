import { describe, expect, it } from 'vitest'
import { lat80Fn77 } from '../src/lib/lat80_77'

describe('lat80_77', () => {
  it('returns 77', () => {
    expect(lat80Fn77()).toBe(77)
  })
})
