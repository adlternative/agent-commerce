import { describe, expect, it } from 'vitest'
import { bis96Fn2 } from '../src/lib/bis96_2'

describe('bis96Fn2', () => {
  it("returns 'task-2'", () => {
    expect(bis96Fn2()).toBe('task-2')
  })
})
