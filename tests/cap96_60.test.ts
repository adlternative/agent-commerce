import { describe, expect, it } from 'vitest'
import { cap96Fn60 } from '../src/lib/cap96_60'

describe('cap96_60', () => {
  it('returns 60', () => {
    expect(cap96Fn60()).toBe(60)
  })
})
