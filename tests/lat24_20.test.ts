import { describe, expect, it } from 'vitest'
import { lat24Fn20 } from '../src/lib/lat24_20'

describe('lat24Fn20', () => {
  it('returns 20', () => {
    expect(lat24Fn20()).toBe(20)
  })
})
