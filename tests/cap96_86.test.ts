import { describe, expect, it } from 'vitest'
import { cap96Fn86 } from '../src/lib/cap96_86'

describe('cap96_86', () => {
  it('returns 86', () => {
    expect(cap96Fn86()).toBe(86)
  })
})
