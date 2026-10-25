import { describe, expect, it } from 'vitest'
import { cap96Fn87 } from '../src/lib/cap96_87'

describe('cap96_87', () => {
  it('returns 87', () => {
    expect(cap96Fn87()).toBe(87)
  })
})
