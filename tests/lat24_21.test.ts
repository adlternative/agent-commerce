import { describe, expect, it } from 'vitest'
import { lat24Fn21 } from '../src/lib/lat24_21'

describe('lat24Fn21', () => {
  it('returns 21', () => {
    expect(lat24Fn21()).toBe(21)
  })
})
