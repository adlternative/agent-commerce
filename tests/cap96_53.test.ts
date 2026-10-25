import { describe, expect, it } from 'vitest'
import { cap96Fn53 } from '../src/lib/cap96_53'

describe('cap96_53', () => {
  it('returns 53', () => {
    expect(cap96Fn53()).toBe(53)
  })
})
