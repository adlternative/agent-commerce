import { describe, expect, it } from 'vitest'
import { lat32Fn2 } from '../src/lib/lat32_2'

describe('lat32Fn2', () => {
  it('returns 2', () => {
    expect(lat32Fn2()).toBe(2)
  })
})
