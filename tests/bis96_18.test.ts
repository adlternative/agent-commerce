import { describe, expect, it } from 'vitest'
import { bis96Fn18 } from '../src/lib/bis96_18'

describe('bis96_18', () => {
  it('bis96Fn18 returns task-18', () => {
    expect(bis96Fn18()).toBe('task-18')
  })
})
