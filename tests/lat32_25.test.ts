import { describe, expect, it } from 'vitest'
import { lat32Fn25 } from '../src/lib/lat32_25'

describe('lat32_25', () => {
  it('returns 25', () => {
    expect(lat32Fn25()).toBe(25)
  })
})
