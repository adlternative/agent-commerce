import { describe, expect, it } from 'vitest'
import { lat32Fn31 } from '../src/lib/lat32_31'

describe('lat32_31', () => {
  it('returns 31', () => {
    expect(lat32Fn31()).toBe(31)
  })
})
