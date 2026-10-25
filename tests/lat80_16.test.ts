import { describe, expect, it } from 'vitest'
import { lat80Fn16 } from '../src/lib/lat80_16'

describe('lat80_16', () => {
  it('returns 16', () => {
    expect(lat80Fn16()).toBe(16)
  })
})
