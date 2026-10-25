import { describe, expect, it } from 'vitest'
import { cap96Fn70 } from '../src/lib/cap96_70'

describe('cap96_70', () => {
  it('returns 70', () => {
    expect(cap96Fn70()).toBe(70)
  })
})
