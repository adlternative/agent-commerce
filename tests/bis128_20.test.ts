import { describe, expect, it } from 'vitest'
import { bis128Fn20 } from '../src/lib/bis128_20'

describe('bis128_20', () => {
  it('bis128Fn20 returns task-20', () => {
    expect(bis128Fn20()).toBe('task-20')
  })
})
