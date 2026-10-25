import { describe, expect, it } from 'vitest'
import { lat32Fn26 } from '../src/lib/lat32_26'

describe('lat32_26', () => {
  it('returns 26', () => {
    expect(lat32Fn26()).toBe(26)
  })
})
