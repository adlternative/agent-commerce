import { describe, expect, it } from 'vitest'
import { lat24Fn23 } from '../src/lib/lat24_23'

describe('lat24_23', () => {
  it('returns 23', () => {
    expect(lat24Fn23()).toBe(23)
  })
})
