import { describe, expect, it } from 'vitest'
import { bis128Fn18 } from '../src/lib/bis128_18'

describe('bis128_18', () => {
  it('bis128Fn18 returns task-18', () => {
    expect(bis128Fn18()).toBe('task-18')
  })
})
