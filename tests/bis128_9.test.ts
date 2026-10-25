import { describe, expect, it } from 'vitest'
import { bis128Fn9 } from '../src/lib/bis128_9'

describe('bis128_9', () => {
  it('bis128Fn9 returns task-9', () => {
    expect(bis128Fn9()).toBe('task-9')
  })
})
