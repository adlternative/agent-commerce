import { describe, expect, it } from 'vitest'
import { bis128Fn27 } from '../src/lib/bis128_27'

describe('bis128_27', () => {
  it('bis128Fn27 returns task-27', () => {
    expect(bis128Fn27()).toBe('task-27')
  })
})
