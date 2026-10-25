import { describe, expect, it } from 'vitest'
import { bis128Fn15 } from '../src/lib/bis128_15'

describe('bis128_15', () => {
  it('bis128Fn15 returns task-15', () => {
    expect(bis128Fn15()).toBe('task-15')
  })
})
