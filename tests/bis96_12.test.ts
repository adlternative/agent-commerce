import { describe, expect, it } from 'vitest'
import { bis96Fn12 } from '../src/lib/bis96_12'

describe('bis96Fn12', () => {
  it("returns 'task-12'", () => {
    expect(bis96Fn12()).toBe('task-12')
  })
})
