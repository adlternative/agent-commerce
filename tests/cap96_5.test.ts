import { describe, expect, it } from 'vitest'
import { cap96Fn5 } from '../src/lib/cap96_5'

describe('cap96Fn5', () => {
  it('returns 5', () => {
    expect(cap96Fn5()).toBe(5)
  })
})
