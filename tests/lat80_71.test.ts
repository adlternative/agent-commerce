import { describe, expect, it } from 'vitest'
import { lat80Fn71 } from '../src/lib/lat80_71'

describe('lat80_71', () => {
  it('returns 71', () => {
    expect(lat80Fn71()).toBe(71)
  })
})
