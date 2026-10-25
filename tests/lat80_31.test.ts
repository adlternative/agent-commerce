import { describe, expect, it } from 'vitest'
import { lat80Fn31 } from '../src/lib/lat80_31'

describe('lat80_31', () => {
  it('lat80Fn31() === 31', () => {
    expect(lat80Fn31()).toBe(31)
  })
})
