import { describe, expect, it } from 'vitest'
import { lat48Fn16 } from '../src/lib/lat48_16'

describe('lat48Fn16', () => {
  it('returns 16', () => {
    expect(lat48Fn16()).toBe(16)
  })
})
