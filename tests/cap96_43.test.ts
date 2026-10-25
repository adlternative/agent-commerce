import { describe, expect, it } from 'vitest'
import { cap96Fn43 } from '../src/lib/cap96_43'

describe('cap96_43', () => {
  it('returns 43', () => {
    expect(cap96Fn43()).toBe(43)
  })
})
