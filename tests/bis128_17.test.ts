import { describe, expect, it } from 'vitest'
import { bis128Fn17 } from '../src/lib/bis128_17'

describe('bis128_17', () => {
  it('bis128Fn17 returns task-17', () => {
    expect(bis128Fn17()).toBe('task-17')
  })
})
