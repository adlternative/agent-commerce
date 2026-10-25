import { describe, expect, it } from 'vitest'
import { lat32Fn6 } from '../src/lib/lat32_6'

describe('lat32_6', () => {
  it('lat32Fn6 returns 6', () => {
    expect(lat32Fn6()).toBe(6)
  })
})
