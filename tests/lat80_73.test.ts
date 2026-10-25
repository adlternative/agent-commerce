import { describe, expect, it } from 'vitest'
import { lat80Fn73 } from '../src/lib/lat80_73'

describe('lat80_73', () => {
  it('returns 73', () => {
    expect(lat80Fn73()).toBe(73)
  })
})
