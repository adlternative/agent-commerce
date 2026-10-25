import { describe, expect, it } from 'vitest'
import { lat32Fn21 } from '../src/lib/lat32_21'

describe('lat32Fn21', () => {
  it('returns 21', () => {
    expect(lat32Fn21()).toBe(21)
  })
})
