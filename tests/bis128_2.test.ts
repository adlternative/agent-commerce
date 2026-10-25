import { describe, expect, it } from 'vitest'
import { bis128Fn2 } from '../src/lib/bis128_2'

describe('bis128Fn2', () => {
  it("returns 'task-2'", () => {
    expect(bis128Fn2()).toBe('task-2')
  })
})
