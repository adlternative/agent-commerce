import { describe, expect, it } from 'vitest'
import { bis128Fn6 } from '../src/lib/bis128_6'

describe('bis128_6', () => {
  it('bis128Fn6 returns task-6', () => {
    expect(bis128Fn6()).toBe('task-6')
  })
})
