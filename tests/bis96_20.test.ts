import { describe, expect, it } from 'vitest'
import { bis96Fn20 } from '../src/lib/bis96_20'

describe('bis96_20', () => {
  it('bis96Fn20 returns task-20', () => {
    expect(bis96Fn20()).toBe('task-20')
  })
})
