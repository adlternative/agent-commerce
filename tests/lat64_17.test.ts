import { describe, expect, it } from 'vitest'
import { lat64Fn17 } from '../src/lib/lat64_17'

describe('lat64Fn17', () => {
  it('returns 17', () => {
    expect(lat64Fn17()).toBe(17)
  })
})
