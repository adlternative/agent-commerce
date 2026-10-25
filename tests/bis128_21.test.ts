import { describe, expect, it } from 'vitest'
import { bis128Fn21 } from '../src/lib/bis128_21'

describe('bis128Fn21', () => {
  it("returns 'task-21'", () => {
    expect(bis128Fn21()).toBe('task-21')
  })
})
