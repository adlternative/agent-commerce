import { describe, expect, it } from 'vitest'
import { lat48Fn26 } from '../src/lib/lat48_26'

describe('lat48Fn26', () => {
  it('returns 26', () => {
    expect(lat48Fn26()).toBe(26)
  })
})
