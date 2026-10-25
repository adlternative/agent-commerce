import { describe, expect, it } from 'vitest'
import { cap96Fn83 } from '../src/lib/cap96_83'

describe('cap96_83', () => {
  it('returns 83', () => {
    expect(cap96Fn83()).toBe(83)
  })
})
