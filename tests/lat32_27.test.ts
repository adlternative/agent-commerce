import { describe, expect, it } from 'vitest'
import { lat32Fn27 } from '../src/lib/lat32_27'

describe('lat32_27', () => {
  it('returns 27', () => {
    expect(lat32Fn27()).toBe(27)
  })
})
