import { describe, expect, it } from 'vitest'
import { lat32Fn32 } from '../src/lib/lat32_32'

describe('lat32_32', () => {
  it('returns 32', () => {
    expect(lat32Fn32()).toBe(32)
  })
})
