import { describe, expect, it } from 'vitest'
import { lat80Fn27 } from '../src/lib/lat80_27'

describe('lat80_27', () => {
  it('returns 27', () => {
    expect(lat80Fn27()).toBe(27)
  })
})
