import { describe, expect, it } from 'vitest'
import { bis128Fn7 } from '../src/lib/bis128_7'

describe('bis128_7', () => {
  it('returns task-7', () => {
    expect(bis128Fn7()).toBe('task-7')
  })
})
