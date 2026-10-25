import { describe, expect, it } from 'vitest'
import { cap96Fn93 } from '../src/lib/cap96_93'

describe('cap96_93', () => {
  it('returns 93', () => {
    expect(cap96Fn93()).toBe(93)
  })
})
