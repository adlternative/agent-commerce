import { describe, expect, it } from 'vitest'
import { bis128Fn5 } from '../src/lib/bis128_5'

describe('bis128Fn5', () => {
  it("returns 'task-5'", () => {
    expect(bis128Fn5()).toBe('task-5')
  })
})
