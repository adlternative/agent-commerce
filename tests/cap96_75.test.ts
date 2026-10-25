import { describe, expect, it } from 'vitest'
import { cap96Fn75 } from '../src/lib/cap96_75'

describe('cap96_75', () => {
  it('returns 75', () => {
    expect(cap96Fn75()).toBe(75)
  })
})
