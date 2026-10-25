import { describe, expect, it } from 'vitest'
import { bis96Fn1 } from '../src/lib/bis96_1'

describe('bis96Fn1', () => {
  it("returns 'task-1'", () => {
    expect(bis96Fn1()).toBe('task-1')
  })
})
