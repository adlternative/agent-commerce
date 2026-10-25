import { describe, expect, it } from 'vitest'
import { lat80Fn67 } from '../src/lib/lat80_67'

describe('lat80_67', () => {
  it('returns 67', () => {
    expect(lat80Fn67()).toBe(67)
  })
})
