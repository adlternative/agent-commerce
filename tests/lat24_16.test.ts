import { describe, expect, it } from 'vitest'
import { lat24Fn16 } from '../src/lib/lat24_16'

describe('lat24Fn16', () => {
  it('returns 16', () => {
    expect(lat24Fn16()).toBe(16)
  })
})
