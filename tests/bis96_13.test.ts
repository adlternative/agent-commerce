import { describe, expect, it } from 'vitest'
import { bis96Fn13 } from '../src/lib/bis96_13'

describe('bis96_13', () => {
  it('bis96Fn13 returns task-13', () => {
    expect(bis96Fn13()).toBe('task-13')
  })
})
