import { describe, expect, it } from 'vitest'
import { cap96Fn3 } from '../src/lib/cap96_3'

describe('cap96_3', () => {
  it('cap96Fn3() === 3', () => {
    expect(cap96Fn3()).toBe(3)
  })
})
