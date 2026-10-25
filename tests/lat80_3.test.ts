import { describe, expect, it } from 'vitest'
import { lat80Fn3 } from '../src/lib/lat80_3'

describe('lat80_3', () => {
  it('lat80Fn3() === 3', () => {
    expect(lat80Fn3()).toBe(3)
  })
})
