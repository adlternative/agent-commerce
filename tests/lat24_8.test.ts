import { describe, expect, it } from 'vitest'
import { lat24Fn8 } from '../src/lib/lat24_8'

describe('lat24Fn8', () => {
  it('returns 8', () => {
    expect(lat24Fn8()).toBe(8)
  })
})
