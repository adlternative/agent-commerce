import { describe, expect, it } from 'vitest'
import { cap96Fn96 } from '../src/lib/cap96_96'

describe('cap96_96', () => {
  it('returns 96', () => {
    expect(cap96Fn96()).toBe(96)
  })
})
