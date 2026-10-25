import { describe, expect, it } from 'vitest'
import { bis128Fn30 } from '../src/lib/bis128_30'

describe('bis128_30', () => {
  it('bis128Fn30 returns task-30', () => {
    expect(bis128Fn30()).toBe('task-30')
  })
})
