import { describe, expect, it } from 'vitest'
import { lat32Fn17 } from '../src/lib/lat32_17'

describe('lat32Fn17', () => {
  it('returns 17', () => {
    expect(lat32Fn17()).toBe(17)
  })
})
