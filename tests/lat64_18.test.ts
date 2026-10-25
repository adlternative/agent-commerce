import { describe, expect, it } from 'vitest'
import { lat64Fn18 } from '../src/lib/lat64_18'

describe('lat64_18', () => {
  it("lat64Fn18 returns 18", () => {
    expect(lat64Fn18()).toBe(18)
  })
})
