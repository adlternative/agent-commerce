import { describe, expect, it } from 'vitest'
import { bis128Fn10 } from '../src/lib/bis128_10'

describe('bis128_10', () => {
  it('returns task-10', () => {
    expect(bis128Fn10()).toBe('task-10')
  })
})
