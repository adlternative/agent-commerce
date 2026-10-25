import { describe, expect, it } from 'vitest'
import { cap96Fn17 } from '../src/lib/cap96_17'

describe('cap96_17', () => {
  it('returns 17', () => {
    expect(cap96Fn17()).toBe(17)
  })
})
