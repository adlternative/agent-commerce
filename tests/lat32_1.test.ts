import { describe, expect, it } from 'vitest'
import { lat32Fn1 } from '../src/lib/lat32_1'

describe('lat32Fn1', () => {
  it('returns 1', () => {
    expect(lat32Fn1()).toBe(1)
  })
})
