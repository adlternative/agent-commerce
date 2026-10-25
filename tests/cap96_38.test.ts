import { describe, expect, it } from 'vitest'
import { cap96Fn38 } from '../src/lib/cap96_38'

describe('cap96_38', () => {
  it('returns 38', () => {
    expect(cap96Fn38()).toBe(38)
  })
})
