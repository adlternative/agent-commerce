import { describe, expect, it } from 'vitest'
import { cap96Fn68 } from '../src/lib/cap96_68'

describe('cap96_68', () => {
  it('returns 68', () => {
    expect(cap96Fn68()).toBe(68)
  })
})
