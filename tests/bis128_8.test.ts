import { describe, expect, it } from 'vitest'
import { bis128Fn8 } from '../src/lib/bis128_8'

describe('bis128Fn8', () => {
  it("returns 'task-8'", () => {
    expect(bis128Fn8()).toBe('task-8')
  })
})
