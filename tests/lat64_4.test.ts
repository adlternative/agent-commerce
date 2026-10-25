import { describe, expect, it } from 'vitest'
import { lat64Fn4 } from '../src/lib/lat64_4'

describe('lat64Fn4', () => {
  it('returns 4', () => {
    expect(lat64Fn4()).toBe(4)
  })
})
