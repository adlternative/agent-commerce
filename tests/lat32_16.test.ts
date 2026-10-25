import { describe, expect, it } from 'vitest'
import { lat32Fn16 } from '../src/lib/lat32_16'

describe('lat32_16', () => {
  it('returns 16', () => {
    expect(lat32Fn16()).toBe(16)
  })
})
