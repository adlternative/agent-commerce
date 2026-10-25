import { describe, expect, it } from 'vitest'
import { bis128Fn1 } from '../src/lib/bis128_1'

describe('bis128_1', () => {
  it('bis128Fn1 returns task-1', () => {
    expect(bis128Fn1()).toBe('task-1')
  })
})
