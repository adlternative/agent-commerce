import { describe, expect, it } from 'vitest'
import { lat80Fn48 } from '../src/lib/lat80_48'

describe('lat80_48', () => {
  it('returns 48', () => {
    expect(lat80Fn48()).toBe(48)
  })
})
