import { describe, expect, it } from 'vitest'
import { c8Fn2 } from '../src/lib/c8_2'

describe('c8Fn2', () => {
  it("returns 'c8-2'", () => {
    expect(c8Fn2()).toBe('c8-2')
  })
})
