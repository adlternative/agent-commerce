import { describe, expect, it } from 'vitest'
import { bis128Fn13 } from '../src/lib/bis128_13'

describe('bis128_13', () => {
  it('bis128Fn13 returns task-13', () => {
    expect(bis128Fn13()).toBe('task-13')
  })
})
