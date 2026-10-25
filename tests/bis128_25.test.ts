import { describe, expect, it } from 'vitest'
import { bis128Fn25 } from '../src/lib/bis128_25'

describe('bis128_25', () => {
  it('bis128Fn25 returns task-25', () => {
    expect(bis128Fn25()).toBe('task-25')
  })
})
