import { describe, expect, it } from 'vitest'
import { lat24Fn12 } from '../src/lib/lat24_12'

describe('lat24Fn12', () => {
  it('returns 12', () => {
    expect(lat24Fn12()).toBe(12)
  })
})
