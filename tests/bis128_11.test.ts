import { describe, expect, it } from 'vitest'
import { bis128Fn11 } from '../src/lib/bis128_11'

describe('bis128_11', () => {
  it('bis128Fn11 returns task-11', () => {
    expect(bis128Fn11()).toBe('task-11')
  })
})
