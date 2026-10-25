import { describe, expect, it } from 'vitest'
import { cap96Fn85 } from '../src/lib/cap96_85'

describe('cap96_85', () => {
  it('returns 85', () => {
    expect(cap96Fn85()).toBe(85)
  })
})
