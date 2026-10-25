import { describe, expect, it } from 'vitest'
import { cap96Fn36 } from '../src/lib/cap96_36'

describe('cap96_36', () => {
  it('returns 36', () => {
    expect(cap96Fn36()).toBe(36)
  })
})
