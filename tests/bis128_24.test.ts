import { describe, expect, it } from 'vitest'
import { bis128Fn24 } from '../src/lib/bis128_24'

describe('bis128_24', () => {
  it('bis128Fn24 returns task-24', () => {
    expect(bis128Fn24()).toBe('task-24')
  })
})
