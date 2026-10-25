import { describe, expect, it } from 'vitest'
import { lat80Fn7 } from '../src/lib/lat80_7'

describe('lat80_7', () => {
  it('lat80Fn7() === 7', () => {
    expect(lat80Fn7()).toBe(7)
  })
})
