import { describe, expect, it } from 'vitest'
import { cap96Fn26 } from '../src/lib/cap96_26'

describe('cap96_26', () => {
  it('returns 26', () => {
    expect(cap96Fn26()).toBe(26)
  })
})
