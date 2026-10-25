import { describe, expect, it } from 'vitest'
import { cap96Fn89 } from '../src/lib/cap96_89'

describe('cap96_89', () => {
  it('returns 89', () => {
    expect(cap96Fn89()).toBe(89)
  })
})
