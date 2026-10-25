import { describe, expect, it } from 'vitest'
import { bis128Fn23 } from '../src/lib/bis128_23'

describe('bis128_23', () => {
  it('bis128Fn23 returns task-23', () => {
    expect(bis128Fn23()).toBe('task-23')
  })
})
