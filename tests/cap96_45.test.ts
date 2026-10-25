import { describe, expect, it } from 'vitest'
import { cap96Fn45 } from '../src/lib/cap96_45'

describe('cap96_45', () => {
  it('returns 45', () => {
    expect(cap96Fn45()).toBe(45)
  })
})
