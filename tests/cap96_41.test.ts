import { describe, expect, it } from 'vitest'
import { cap96Fn41 } from '../src/lib/cap96_41'

describe('cap96_41', () => {
  it('returns 41', () => {
    expect(cap96Fn41()).toBe(41)
  })
})
