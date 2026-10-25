import { describe, expect, it } from 'vitest'
import { bis128Fn12 } from '../src/lib/bis128_12'

describe('bis128_12', () => {
  it('returns task-12', () => {
    expect(bis128Fn12()).toBe('task-12')
  })
})
