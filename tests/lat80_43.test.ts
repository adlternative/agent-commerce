import { describe, expect, it } from 'vitest'
import { lat80Fn43 } from '../src/lib/lat80_43'

describe('lat80_43', () => {
  it('returns 43', () => {
    expect(lat80Fn43()).toBe(43)
  })
})
