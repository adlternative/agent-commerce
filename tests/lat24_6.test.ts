import { describe, expect, it } from 'vitest'
import { lat24Fn6 } from '../src/lib/lat24_6'

describe('lat24_6', () => {
  it('returns 6', () => {
    expect(lat24Fn6()).toBe(6)
  })
})
