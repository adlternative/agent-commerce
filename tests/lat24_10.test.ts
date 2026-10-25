import { describe, expect, it } from 'vitest'
import { lat24Fn10 } from '../src/lib/lat24_10'

describe('lat24_10', () => {
  it('returns 10', () => {
    expect(lat24Fn10()).toBe(10)
  })
})
