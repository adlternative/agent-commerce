import { describe, expect, it } from 'vitest'
import { cap96Fn66 } from '../src/lib/cap96_66'

describe('cap96_66', () => {
  it('returns 66', () => {
    expect(cap96Fn66()).toBe(66)
  })
})
