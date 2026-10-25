import { describe, expect, it } from 'vitest'
import { bis128Fn32 } from '../src/lib/bis128_32'

describe('bis128_32', () => {
  it('bis128Fn32 returns task-32', () => {
    expect(bis128Fn32()).toBe('task-32')
  })
})
