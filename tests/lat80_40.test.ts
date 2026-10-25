import { describe, expect, it } from 'vitest'
import { lat80Fn40 } from '../src/lib/lat80_40'

describe('lat80_40', () => {
  it('returns 40', () => {
    expect(lat80Fn40()).toBe(40)
  })
})
