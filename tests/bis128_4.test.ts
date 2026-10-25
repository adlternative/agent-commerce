import { describe, expect, it } from 'vitest'
import { bis128Fn4 } from '../src/lib/bis128_4'

describe('bis128Fn4', () => {
  it("returns 'task-4'", () => {
    expect(bis128Fn4()).toBe('task-4')
  })
})
