import { describe, expect, it } from 'vitest'
import { lat24Fn17 } from '../src/lib/lat24_17'

describe('lat24Fn17', () => {
  it('returns 17', () => {
    expect(lat24Fn17()).toBe(17)
  })
})
