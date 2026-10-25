import { describe, expect, it } from 'vitest'
import { cap96Fn40 } from '../src/lib/cap96_40'

describe('cap96_40', () => {
  it('returns 40', () => {
    expect(cap96Fn40()).toBe(40)
  })
})
