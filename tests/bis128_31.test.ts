import { describe, expect, it } from 'vitest'
import { bis128Fn31 } from '../src/lib/bis128_31'

describe('bis128_31', () => {
  it('bis128Fn31 returns task-31', () => {
    expect(bis128Fn31()).toBe('task-31')
  })
})
