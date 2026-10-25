import { describe, expect, it } from 'vitest'
import { lat48Fn27 } from '../src/lib/lat48_27'

describe('lat48Fn27', () => {
  it('returns 27', () => {
    expect(lat48Fn27()).toBe(27)
  })
})
