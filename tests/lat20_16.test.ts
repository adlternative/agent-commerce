import { describe, expect, it } from 'vitest'
import { lat20Fn16 } from '../src/lib/lat20_16'

describe('lat20Fn16', () => {
  it('returns 16', () => {
    expect(lat20Fn16()).toBe(16)
  })
})
