import { describe, expect, it } from 'vitest'
import { bis128Fn3 } from '../src/lib/bis128_3'

describe('bis128Fn3', () => {
  it("returns 'task-3'", () => {
    expect(bis128Fn3()).toBe('task-3')
  })
})
