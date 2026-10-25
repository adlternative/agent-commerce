import { describe, expect, it } from 'vitest'
import { bis96Fn6 } from '../src/lib/bis96_6'

describe('bis96Fn6', () => {
  it("returns 'task-6'", () => {
    expect(bis96Fn6()).toBe('task-6')
  })
})
