import { describe, expect, it } from 'vitest'
import { lat24Fn24 } from '../src/lib/lat24_24'

describe('lat24Fn24', () => {
  it('returns 24', () => {
    expect(lat24Fn24()).toBe(24)
  })
})
