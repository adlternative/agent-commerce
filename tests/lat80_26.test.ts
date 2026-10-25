import { describe, expect, it } from 'vitest'
import { lat80Fn26 } from '../src/lib/lat80_26'

describe('lat80_26', () => {
  it('returns 26', () => {
    expect(lat80Fn26()).toBe(26)
  })
})
