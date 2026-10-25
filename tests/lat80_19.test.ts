import { describe, expect, it } from 'vitest'
import { lat80Fn19 } from '../src/lib/lat80_19'

describe('lat80_19', () => {
  it('returns 19', () => {
    expect(lat80Fn19()).toBe(19)
  })
})
