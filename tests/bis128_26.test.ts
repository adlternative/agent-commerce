import { describe, expect, it } from 'vitest'
import { bis128Fn26 } from '../src/lib/bis128_26'

describe('bis128_26', () => {
  it('bis128Fn26 returns task-26', () => {
    expect(bis128Fn26()).toBe('task-26')
  })
})
