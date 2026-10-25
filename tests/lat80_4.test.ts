import { describe, expect, it } from 'vitest'
import { lat80Fn4 } from '../src/lib/lat80_4'

describe('lat80_4', () => {
  it('returns 4', () => {
    expect(lat80Fn4()).toBe(4)
  })
})
