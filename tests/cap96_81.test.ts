import { describe, expect, it } from 'vitest'
import { cap96Fn81 } from '../src/lib/cap96_81'

describe('cap96_81', () => {
  it('returns 81', () => {
    expect(cap96Fn81()).toBe(81)
  })
})
