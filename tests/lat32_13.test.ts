import { describe, expect, it } from 'vitest'
import { lat32Fn13 } from '../src/lib/lat32_13'

describe('lat32Fn13', () => {
  it('returns 13', () => {
    expect(lat32Fn13()).toBe(13)
  })
})
