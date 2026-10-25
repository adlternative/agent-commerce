import { describe, expect, it } from 'vitest'
import { cap96Fn84 } from '../src/lib/cap96_84'

describe('cap96_84', () => {
  it('returns 84', () => {
    expect(cap96Fn84()).toBe(84)
  })
})
