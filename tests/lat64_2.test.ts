import { describe, expect, it } from 'vitest'
import { lat64Fn2 } from '../src/lib/lat64_2'

describe('lat64Fn2', () => {
  it('returns 2', () => {
    expect(lat64Fn2()).toBe(2)
  })
})
