import { describe, expect, it } from 'vitest'
import { cap96Fn48 } from '../src/lib/cap96_48'

describe('cap96_48', () => {
  it('returns 48', () => {
    expect(cap96Fn48()).toBe(48)
  })
})
