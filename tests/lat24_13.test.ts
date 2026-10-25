import { describe, expect, it } from 'vitest'
import { lat24Fn13 } from '../src/lib/lat24_13'

describe('lat24Fn13', () => {
  it('returns 13', () => {
    expect(lat24Fn13()).toBe(13)
  })
})
