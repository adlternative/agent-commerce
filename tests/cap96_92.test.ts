import { describe, expect, it } from 'vitest'
import { cap96Fn92 } from '../src/lib/cap96_92'

describe('cap96_92', () => {
  it('returns 92', () => {
    expect(cap96Fn92()).toBe(92)
  })
})
