import { describe, expect, it } from 'vitest'
import { lat24Fn15 } from '../src/lib/lat24_15'

describe('lat24Fn15', () => {
  it('returns 15', () => {
    expect(lat24Fn15()).toBe(15)
  })
})
