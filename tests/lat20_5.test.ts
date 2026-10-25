import { describe, expect, it } from 'vitest'
import { lat20Fn5 } from '../src/lib/lat20_5'

describe('lat20Fn5', () => {
  it('returns 5', () => {
    expect(lat20Fn5()).toBe(5)
  })
})
