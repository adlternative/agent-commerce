import { describe, expect, it } from 'vitest'
import { bis128Fn16 } from '../src/lib/bis128_16'

describe('bis128_16', () => {
  it('returns task-16', () => {
    expect(bis128Fn16()).toBe('task-16')
  })
})
