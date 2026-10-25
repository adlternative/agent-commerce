import { describe, expect, it } from 'vitest'
import { cap96Fn16 } from '../src/lib/cap96_16'

describe('cap96_16', () => {
  it('returns 16', () => {
    expect(cap96Fn16()).toBe(16)
  })
})
