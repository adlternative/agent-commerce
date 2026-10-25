import { describe, expect, it } from 'vitest'
import { bis128Fn14 } from '../src/lib/bis128_14'

describe('bis128_14', () => {
  it('bis128Fn14 returns task-14', () => {
    expect(bis128Fn14()).toBe('task-14')
  })
})
