import { describe, expect, it } from 'vitest'
import { lat64Fn8 } from '../src/lib/lat64_8'

describe('lat64_8', () => {
  it('lat64Fn8 returns 8', () => {
    expect(lat64Fn8()).toBe(8)
  })
})
